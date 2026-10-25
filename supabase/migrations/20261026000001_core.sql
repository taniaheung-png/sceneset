-- SceneSet 001: profiles, workspaces, memberships, helper functions, member-management RPCs, RLS.
-- Apply to a DEVELOPMENT Supabase project only (see README). Safe to review before running.
--
-- Design notes
--  * Every table has RLS enabled. Writes that change roles/membership go through the RPCs below
--    (SECURITY DEFINER with a fixed search_path); the client has no direct INSERT/UPDATE/DELETE on
--    workspace_members.
--  * Table privileges are revoked from anon/authenticated and re-granted narrowly, because Supabase
--    grants new tables to those roles by default.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Sandbox entitlement (no real billing). Changed only by a server function in phase 7.
  plan text not null default 'free' check (plan in ('free', 'organiser')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'organiser', 'collaborator')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------- triggers

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();

-- Minimal profile for each new auth user (no duplicated credentials).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), ''), 80)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- A workspace must always keep one owner. Skipped while the workspace itself is being deleted.
create function public.protect_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if exists (select 1 from public.workspaces where id = old.workspace_id)
       and not exists (
         select 1 from public.workspace_members
         where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id
       ) then
      raise exception 'A workspace must keep at least one owner' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger workspace_members_last_owner before update or delete on public.workspace_members
  for each row execute function public.protect_last_owner();

-- ------------------------------------------------------- authorisation helpers
-- SECURITY DEFINER so policies on workspace_members can call them without recursing into RLS.

create function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members where workspace_id = ws and user_id = auth.uid()
  )
$$;

create function public.has_role(ws uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = any (roles)
  )
$$;

create function public.shares_workspace(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on b.workspace_id = a.workspace_id
    where a.user_id = auth.uid() and b.user_id = other
  )
$$;

-- ------------------------------------------------------------------- RPCs

create function public.create_workspace(ws_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  insert into public.workspaces (name, created_by) values (btrim(ws_name), uid) returning id into new_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (new_id, uid, 'owner');
  return new_id;
end $$;

create function public.add_workspace_member(ws uuid, member_email text, member_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if not public.has_role(ws, array['owner']) then
    raise exception 'Only owners can manage members' using errcode = '42501';
  end if;
  if member_role not in ('owner', 'organiser', 'collaborator') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  select id into target from auth.users where lower(email) = lower(btrim(member_email));
  if target is null then
    raise exception 'No registered account with that email. Ask them to sign up first.' using errcode = 'P0002';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, target, member_role);
exception
  when unique_violation then
    raise exception 'That person is already a member' using errcode = '23505';
end $$;

create function public.set_member_role(ws uuid, target uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(ws, array['owner']) then
    raise exception 'Only owners can manage members' using errcode = '42501';
  end if;
  if new_role not in ('owner', 'organiser', 'collaborator') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  update public.workspace_members set role = new_role where workspace_id = ws and user_id = target;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
end $$;

-- Owners remove anyone; any member may remove themselves (leave). Last owner is protected by trigger.
create function public.remove_member(ws uuid, target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.has_role(ws, array['owner']) or (target = auth.uid() and public.is_member(ws))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.workspace_members where workspace_id = ws and user_id = target;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
end $$;

-- Member list. Email is returned to owners only (data minimisation).
create function public.list_workspace_members(ws uuid)
returns table (user_id uuid, display_name text, role text, email text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id,
         p.display_name,
         m.role,
         case when public.has_role(ws, array['owner']) then u.email::text end,
         m.created_at
  from public.workspace_members m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.workspace_id = ws and public.is_member(ws)
  order by case m.role when 'owner' then 0 when 'organiser' then 1 else 2 end, p.display_name
$$;

create function public.delete_workspace(ws uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(ws, array['owner']) then
    raise exception 'Only owners can delete a workspace' using errcode = '42501';
  end if;
  delete from public.workspaces where id = ws;
end $$;

-- -------------------------------------------------------------- privileges

revoke execute on function
  public.touch_updated_at(), public.handle_new_user(), public.protect_last_owner()
  from public, anon, authenticated;

revoke execute on function
  public.is_member(uuid), public.has_role(uuid, text[]), public.shares_workspace(uuid),
  public.create_workspace(text), public.add_workspace_member(uuid, text, text),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid),
  public.list_workspace_members(uuid), public.delete_workspace(uuid)
  from public, anon;

grant execute on function
  public.is_member(uuid), public.has_role(uuid, text[]), public.shares_workspace(uuid),
  public.create_workspace(text), public.add_workspace_member(uuid, text, text),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid),
  public.list_workspace_members(uuid), public.delete_workspace(uuid)
  to authenticated;

revoke all on public.profiles, public.workspaces, public.workspace_members from anon, authenticated;
grant select on public.profiles, public.workspaces, public.workspace_members to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name) on public.workspaces to authenticated;

-- --------------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_workspace(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_member(id));
create policy workspaces_rename on public.workspaces for update to authenticated
  using (public.has_role(id, array['owner'])) with check (public.has_role(id, array['owner']));

create policy members_select on public.workspace_members for select to authenticated
  using (public.is_member(workspace_id));
-- No INSERT/UPDATE/DELETE policies: membership changes only through the RPCs above.
