-- SceneSet 007: sandbox entitlements and plan limits. TEST MODE ONLY: no card data, no money, no payment provider.
-- The plan (workspaces.plan) and the per-event upgrade (events.event_upgrade) cannot be written by clients (column grants
-- in 001/002); they change only through the two functions below, which re-check that the caller is a workspace owner.
-- Plan limits are enforced here as well as in the app, so a direct API call cannot exceed them.
--
--   Free Personal : 1 active event,  3 members (owner + 2)
--   Event Upgrade : unchanged events limit; up to 10 members once any event in the workspace is upgraded
--   Organiser     : unlimited events and members
-- Sample (demo) events never count toward the event limit; archived events do not count either.

-- ---------------------------------------------------------------- limits

create function public.plan_limits(ws uuid, out max_events integer, out max_members integer)
language sql stable security definer set search_path = '' as $$
  select
    case when w.plan = 'organiser' then null else 1 end,
    case when w.plan = 'organiser' then null
         when exists (select 1 from public.events e where e.workspace_id = w.id and e.event_upgrade) then 10
         else 3 end
  from public.workspaces w where w.id = ws
$$;

create function public.check_event_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim integer; n integer;
begin
  if new.demo or new.archived_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.archived_at is null then return new; end if; -- already active
  select max_events into lim from public.plan_limits(new.workspace_id);
  if lim is null then return new; end if;
  select count(*) into n from public.events
   where workspace_id = new.workspace_id and archived_at is null and not demo and id <> new.id;
  if n >= lim then
    raise exception 'The free plan allows % active event. Archive one, or use a test upgrade.', lim using errcode = '53400';
  end if;
  return new;
end $$;
create trigger events_limit before insert or update of archived_at on public.events
  for each row execute function public.check_event_limit();

create function public.check_member_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim integer; n integer;
begin
  select max_members into lim from public.plan_limits(new.workspace_id);
  if lim is null then return new; end if;
  select count(*) into n from public.workspace_members where workspace_id = new.workspace_id;
  if n >= lim then
    raise exception 'This plan allows % members. Use a test upgrade for more.', lim using errcode = '53400';
  end if;
  return new;
end $$;
create trigger members_limit before insert on public.workspace_members
  for each row execute function public.check_member_limit();

-- ---------------------------------------------------------------- sandbox checkout

-- plan_id: 'event' (needs ev) or 'organiser' (ev must be null). outcome is what the simulated checkout reported.
-- Only 'success' changes an entitlement; every attempt is logged once per idempotency key, and replaying a key
-- returns the first outcome without doing anything again.
create function public.sandbox_checkout(ws uuid, plan_id text, ev uuid, outcome text, idem text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare prior public.entitlement_events%rowtype; cur text; inserted uuid;
begin
  if auth.uid() is null or not public.has_role(ws, array['owner']) then
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

  insert into public.entitlement_events (workspace_id, event_id, plan, outcome, idempotency_key)
    values (ws, ev, plan_id, outcome, idem) on conflict (idempotency_key) do nothing returning id into inserted;
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

-- Ends the simulated Organiser plan (no recurring billing exists). Event upgrades are one-off and stay.
create function public.sandbox_end_organiser(ws uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null or not public.has_role(ws, array['owner']) then
    raise exception 'Only a workspace owner can change test plans' using errcode = '42501';
  end if;
  update public.workspaces set plan = 'free' where id = ws and plan = 'organiser';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ---------------------------------------------------------------- privileges

revoke execute on function public.check_event_limit(), public.check_member_limit(), public.plan_limits(uuid)
  from public, anon, authenticated;
revoke execute on function public.sandbox_checkout(uuid, text, uuid, text, text), public.sandbox_end_organiser(uuid)
  from public, anon;
grant execute on function public.sandbox_checkout(uuid, text, uuid, text, text), public.sandbox_end_organiser(uuid)
  to authenticated;
