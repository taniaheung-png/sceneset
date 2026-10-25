-- SceneSet 002: venues, events, tasks, schedule, notes, guests, layout items (+ RLS).
--
-- Tenant integrity is declarative: every child row carries workspace_id and uses COMPOSITE foreign keys
--   (event_id, workspace_id)    -> events(id, workspace_id)
--   (workspace_id, assignee_id) -> workspace_members(workspace_id, user_id)
-- so a forged ID from another workspace is rejected by the database itself, not just by app code.
-- Money is integer minor units (1/100 of the currency unit). Instants are timestamptz; the event's
-- IANA timezone is used only for display.

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address_note text not null default '' check (char_length(address_note) <= 300),
  width_cm integer not null check (width_cm between 1 and 1000000),
  depth_cm integer not null check (depth_cm between 1 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  type text not null default 'other' check (char_length(type) <= 40),
  goals text not null default '' check (char_length(goals) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Hong_Kong',
  currency char(3) not null default 'HKD' check (currency ~ '^[A-Z]{3}$'),
  venue_id uuid,
  capacity integer check (capacity is null or capacity >= 0),
  budget_target_minor bigint not null default 0 check (budget_target_minor >= 0),
  status text not null default 'planning' check (status in ('planning', 'confirmed', 'done')),
  archived_at timestamptz,
  -- Sandbox per-event entitlement; changed only by a server function in phase 7.
  event_upgrade boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (id, workspace_id),
  -- Deleting a venue keeps the event (history); only venue_id is nulled.
  foreign key (venue_id, workspace_id) references public.venues (id, workspace_id) on delete set null (venue_id)
);
create index events_workspace_idx on public.events (workspace_id, starts_at);

create function public.validate_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception when others then
  raise exception 'Unknown timezone: %', new.timezone using errcode = '22023';
end $$;

create trigger events_timezone before insert or update of timezone on public.events
  for each row execute function public.validate_timezone();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  event_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_on date,
  assignee_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, workspace_id) references public.events (id, workspace_id) on delete cascade,
  foreign key (workspace_id, assignee_id) references public.workspace_members (workspace_id, user_id)
    on delete set null (assignee_id)
);
create index tasks_event_idx on public.tasks (event_id, status);

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  event_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '' check (char_length(location) <= 120),
  owner_id uuid,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (event_id, workspace_id) references public.events (id, workspace_id) on delete cascade,
  foreign key (workspace_id, owner_id) references public.workspace_members (workspace_id, user_id)
    on delete set null (owner_id)
);
-- Deterministic order: start, end, id.
create index schedule_event_idx on public.schedule_entries (event_id, starts_at, ends_at, id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  event_id uuid not null,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, workspace_id) references public.events (id, workspace_id) on delete cascade
);
create index notes_event_idx on public.notes (event_id, created_at);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  event_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  contact text check (contact is null or char_length(contact) <= 200),
  group_name text not null default '' check (char_length(group_name) <= 60),
  party_size integer not null default 1 check (party_size between 1 and 50),
  rsvp text not null default 'invited' check (rsvp in ('invited', 'confirmed', 'tentative', 'declined')),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, workspace_id) references public.events (id, workspace_id) on delete cascade
);
create index guests_event_idx on public.guests (event_id, rsvp);

create table public.layout_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  event_id uuid not null,
  kind text not null check (kind in ('table', 'stage', 'entrance', 'booth', 'other')),
  label text not null default '' check (char_length(label) <= 60),
  x_cm integer not null check (x_cm >= 0),
  y_cm integer not null check (y_cm >= 0),
  w_cm integer not null check (w_cm > 0),
  h_cm integer not null check (h_cm > 0),
  rotation integer not null default 0 check (rotation between 0 and 359),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, workspace_id) references public.events (id, workspace_id) on delete cascade
);
create index layout_event_idx on public.layout_items (event_id);

-- Layout items must sit inside the event's venue.
-- shortcut: shrinking a venue later does not re-check existing items; app warns, upgrade if it matters.
create function public.check_layout_bounds() returns trigger
language plpgsql set search_path = '' as $$
declare
  vw integer;
  vd integer;
begin
  select v.width_cm, v.depth_cm into vw, vd
  from public.events e join public.venues v on v.id = e.venue_id
  where e.id = new.event_id;
  if vw is null then
    raise exception 'Choose a venue for the event before placing layout items' using errcode = '23514';
  end if;
  if new.x_cm + new.w_cm > vw or new.y_cm + new.h_cm > vd then
    raise exception 'Layout item must stay inside the venue (% x % cm)', vw, vd using errcode = '23514';
  end if;
  return new;
end $$;

create trigger layout_bounds before insert or update on public.layout_items
  for each row execute function public.check_layout_bounds();

-- Collaborators may change only the status of tasks assigned to them. (auth.uid() null = admin/maintenance.)
-- pg_trigger_depth() = 1 means a direct UPDATE; FK actions (member removed -> assignee set null,
-- workspace deleted) run nested and must not be blocked by this guard.
create function public.restrict_collaborator_task_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null
     and not public.has_role(old.workspace_id, array['owner', 'organiser']) then
    if (new.id, new.workspace_id, new.event_id, new.title, new.description, new.priority, new.due_on,
        new.assignee_id, new.created_by)
       is distinct from
       (old.id, old.workspace_id, old.event_id, old.title, old.description, old.priority, old.due_on,
        old.assignee_id, old.created_by) then
      raise exception 'Collaborators can only change the status of tasks assigned to them' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger tasks_collaborator_guard before update on public.tasks
  for each row execute function public.restrict_collaborator_task_update();

do $$
declare t text;
begin
  foreach t in array array['venues', 'events', 'tasks', 'schedule_entries', 'notes', 'guests', 'layout_items'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))', t || '_select', t);
  end loop;

  -- Owner/organiser manage these outright. (tasks and notes have finer rules below.)
  foreach t in array array['venues', 'events', 'schedule_entries', 'guests', 'layout_items'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(workspace_id, array[''owner'',''organiser'']))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(workspace_id, array[''owner'',''organiser''])) with check (public.has_role(workspace_id, array[''owner'',''organiser'']))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_role(workspace_id, array[''owner'',''organiser'']))', t || '_delete', t);
  end loop;
end $$;

-- Column-limited writes (workspace_id/event_id are never changed after insert; event_upgrade only via server function).
grant insert (workspace_id, name, address_note, width_cm, depth_cm) on public.venues to authenticated;
grant update (name, address_note, width_cm, depth_cm) on public.venues to authenticated;

grant insert (workspace_id, title, type, goals, starts_at, ends_at, timezone, currency, venue_id, capacity,
              budget_target_minor, status, archived_at, created_by) on public.events to authenticated;
grant update (title, type, goals, starts_at, ends_at, timezone, currency, venue_id, capacity,
              budget_target_minor, status, archived_at) on public.events to authenticated;
create policy events_creator on public.events as restrictive for insert to authenticated
  with check (created_by = (select auth.uid()));

grant insert (workspace_id, event_id, title, starts_at, ends_at, location, owner_id, notes) on public.schedule_entries to authenticated;
grant update (title, starts_at, ends_at, location, owner_id, notes) on public.schedule_entries to authenticated;

grant insert (workspace_id, event_id, name, contact, group_name, party_size, rsvp, notes) on public.guests to authenticated;
grant update (name, contact, group_name, party_size, rsvp, notes) on public.guests to authenticated;

grant insert (workspace_id, event_id, kind, label, x_cm, y_cm, w_cm, h_cm, rotation) on public.layout_items to authenticated;
grant update (kind, label, x_cm, y_cm, w_cm, h_cm, rotation) on public.layout_items to authenticated;

-- Tasks: owner/organiser full control; collaborators update (status only, via trigger) their own assigned tasks.
grant insert (workspace_id, event_id, title, description, status, priority, due_on, assignee_id, created_by) on public.tasks to authenticated;
grant update (title, description, status, priority, due_on, assignee_id) on public.tasks to authenticated;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.has_role(workspace_id, array['owner', 'organiser']) and created_by = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (public.has_role(workspace_id, array['owner', 'organiser'])
         or (assignee_id = (select auth.uid()) and public.is_member(workspace_id)))
  with check (public.has_role(workspace_id, array['owner', 'organiser'])
         or (assignee_id = (select auth.uid()) and public.is_member(workspace_id)));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.has_role(workspace_id, array['owner', 'organiser']));

-- Notes: every member may add their own; owner/organiser may edit/delete any; others only their own.
grant insert (workspace_id, event_id, body, author_id) on public.notes to authenticated;
grant update (body) on public.notes to authenticated;
create policy notes_insert on public.notes for insert to authenticated
  with check (public.is_member(workspace_id) and author_id = (select auth.uid()));
create policy notes_update on public.notes for update to authenticated
  using (public.has_role(workspace_id, array['owner', 'organiser']) or author_id = (select auth.uid()))
  with check (public.has_role(workspace_id, array['owner', 'organiser']) or author_id = (select auth.uid()));
create policy notes_delete on public.notes for delete to authenticated
  using (public.has_role(workspace_id, array['owner', 'organiser']) or author_id = (select auth.uid()));
