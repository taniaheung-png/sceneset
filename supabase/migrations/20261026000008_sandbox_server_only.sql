-- SceneSet 008: the sandbox functions become server-only. TEST MODE ONLY: no card data, no money.
--
-- Why: migration 007 let any workspace owner call sandbox_checkout and sandbox_end_organiser straight through the public
-- API with their own session. That bypassed the app's PAYMENT_SANDBOX_ENABLED switch, which only the server can read.
-- Now the functions can be executed only by the server's secret key (service_role). The server action authenticates the
-- user, checks the switch, and passes the verified user id as `actor`; the function still re-checks that the actor owns
-- the workspace and that the event belongs to it. A signed-in user calling the API directly gets 42501.

drop function public.sandbox_checkout(uuid, text, uuid, text, text);
drop function public.sandbox_end_organiser(uuid);

create function public.sandbox_checkout(actor uuid, ws uuid, plan_id text, ev uuid, outcome text, idem text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare prior public.entitlement_events%rowtype; cur text; inserted uuid;
begin
  if actor is null or not exists (
    select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = actor and m.role = 'owner'
  ) then
    raise exception 'Only a workspace owner can change test plans' using errcode = '42501';
  end if;
  if plan_id not in ('event', 'organiser') or outcome not in ('success', 'cancelled', 'failed')
     or idem is null or idem !~ '^[A-Za-z0-9-]{16,64}$'
     or (plan_id = 'event' and ev is null) or (plan_id = 'organiser' and ev is not null) then
    raise exception 'Unknown plan, outcome or request key' using errcode = '22023';
  end if;
  if plan_id = 'event' and not exists (select 1 from public.events where id = ev and workspace_id = ws) then
    raise exception 'Event not found in this workspace' using errcode = 'P0002';
  end if;

  perform 1 from public.workspaces where id = ws for update; -- one checkout at a time per workspace

  select * into prior from public.entitlement_events where idempotency_key = idem;
  if found then
    if prior.workspace_id <> ws or prior.plan <> plan_id or prior.event_id is distinct from ev then
      raise exception 'Request key already used for something else' using errcode = '22023';
    end if;
    return jsonb_build_object('outcome', prior.outcome, 'replayed', true);
  end if;

  select w.plan into cur from public.workspaces w where w.id = ws;
  if cur = 'organiser' or (plan_id = 'event' and exists (select 1 from public.events where id = ev and event_upgrade)) then
    raise exception 'This is already covered by the current test plan' using errcode = 'P0001';
  end if;

  insert into public.entitlement_events (workspace_id, event_id, plan, outcome, idempotency_key, created_by)
    values (ws, ev, plan_id, outcome, idem, actor) on conflict (idempotency_key) do nothing returning id into inserted;
  if inserted is null then
    return jsonb_build_object('outcome', outcome, 'replayed', true);
  end if;

  if outcome = 'success' then
    if plan_id = 'organiser' then
      update public.workspaces set plan = 'organiser' where id = ws;
    else
      update public.events set event_upgrade = true where id = ev and workspace_id = ws;
    end if;
  end if;
  return jsonb_build_object('outcome', outcome, 'replayed', false);
end $$;

create function public.sandbox_end_organiser(actor uuid, ws uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if actor is null or not exists (
    select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = actor and m.role = 'owner'
  ) then
    raise exception 'Only a workspace owner can change test plans' using errcode = '42501';
  end if;
  update public.workspaces set plan = 'free' where id = ws and plan = 'organiser';
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke execute on function public.sandbox_checkout(uuid, uuid, text, uuid, text, text), public.sandbox_end_organiser(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.sandbox_checkout(uuid, uuid, text, uuid, text, text), public.sandbox_end_organiser(uuid, uuid)
  to service_role;

-- Fix to the 007 member-limit trigger: adding someone who is already a member must still report "already a member"
-- (the primary key violation), not the plan limit. Found by the Phase 2 browser suite at exactly 3 members.
create or replace function public.check_member_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim integer; n integer;
begin
  if exists (select 1 from public.workspace_members where workspace_id = new.workspace_id and user_id = new.user_id) then
    return new; -- the primary key reports the duplicate
  end if;
  select max_members into lim from public.plan_limits(new.workspace_id);
  if lim is null then return new; end if;
  select count(*) into n from public.workspace_members where workspace_id = new.workspace_id;
  if n >= lim then
    raise exception 'This plan allows % members. Use a test upgrade for more.', lim using errcode = '53400';
  end if;
  return new;
end $$;
