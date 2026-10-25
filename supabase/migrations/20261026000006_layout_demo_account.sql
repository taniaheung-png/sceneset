-- SceneSet 006: venue/layout safety, atomic layout save, sample-event load/reset, account-deletion helpers.
--
--  * A venue can never be made smaller than a layout item that sits on it, and an event can only be attached
--    to a venue that fits its saved layout (closes the "shrinking a venue" shortcut from migration 002).
--  * save_layout() applies a whole layout edit in ONE transaction with a stale-edit check per item, as the
--    caller (RLS and the bounds trigger still apply), so a conflict or an out-of-bounds item changes nothing.
--  * reset_demo() (re)creates a fictional sample event in ONE workspace the caller owns/organises. Only rows
--    flagged `demo` are ever removed; real data is never touched.
--  * account_deletion_blockers() / remove_my_sole_workspaces() support the documented deletion policy.

-- ------------------------------------------------------------------ venue fit

create function public.check_venue_fits_layout() returns trigger
language plpgsql set search_path = '' as $$
declare
  n integer;
begin
  if tg_table_name = 'venues' then
    -- Resizing a venue: every layout item of every event that uses it must still fit the NEW size.
    select count(*) into n
    from public.layout_items li
    join public.events e on e.id = li.event_id
    where e.venue_id = new.id and (li.x_cm + li.w_cm > new.width_cm or li.y_cm + li.h_cm > new.depth_cm);
  else
    -- Attaching a venue to an event: this event's saved items must fit the venue being attached.
    if new.venue_id is null then return new; end if;
    select count(*) into n
    from public.layout_items li
    join public.venues v on v.id = new.venue_id
    where li.event_id = new.id and (li.x_cm + li.w_cm > v.width_cm or li.y_cm + li.h_cm > v.depth_cm);
  end if;
  if n > 0 then
    raise exception '% layout item(s) would fall outside this venue. Move or delete them first.', n using errcode = '23514';
  end if;
  return new;
end $$;

create trigger venues_fit_layout before update of width_cm, depth_cm on public.venues
  for each row execute function public.check_venue_fits_layout();
create trigger events_venue_fits_layout before update of venue_id on public.events
  for each row when (new.venue_id is distinct from old.venue_id)
  execute function public.check_venue_fits_layout();

-- ------------------------------------------------------------- atomic layout save

create function public.save_layout(ev uuid, upserts jsonb, deletes uuid[]) returns integer
language plpgsql set search_path = '' as $$
declare
  e record;
  u jsonb;
  n integer := 0;
  c integer;
begin
  select id, workspace_id into e from public.events where id = ev;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if not public.has_role(e.workspace_id, array['owner', 'organiser']) then
    raise exception 'Only organisers and owners can edit the layout' using errcode = '42501';
  end if;

  if deletes is not null and array_length(deletes, 1) > 0 then
    delete from public.layout_items where event_id = ev and id = any (deletes);
    get diagnostics c = row_count;
    n := n + c;
  end if;

  for u in select * from jsonb_array_elements(coalesce(upserts, '[]'::jsonb)) loop
    if coalesce(u ->> 'id', '') <> '' then
      update public.layout_items
         set kind = u ->> 'kind', label = u ->> 'label',
             x_cm = (u ->> 'x')::integer, y_cm = (u ->> 'y')::integer,
             w_cm = (u ->> 'w')::integer, h_cm = (u ->> 'h')::integer
       where id = (u ->> 'id')::uuid and event_id = ev and updated_at = (u ->> 'version')::timestamptz;
      if not found then
        raise exception 'The layout was changed by someone else. Reload to see the latest version.' using errcode = 'P0001';
      end if;
    else
      insert into public.layout_items (workspace_id, event_id, kind, label, x_cm, y_cm, w_cm, h_cm)
      values (e.workspace_id, ev, u ->> 'kind', u ->> 'label', (u ->> 'x')::integer, (u ->> 'y')::integer, (u ->> 'w')::integer, (u ->> 'h')::integer);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------------ sample data

alter table public.venues add column demo boolean not null default false;
alter table public.suppliers add column demo boolean not null default false;
alter table public.events add column demo boolean not null default false;
-- `demo` is not in any client INSERT/UPDATE column grant, so only reset_demo() can set it.

create function public.reset_demo(ws uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v uuid;
  ev uuid;
  start_at timestamptz;
  s_lantern uuid; s_glow uuid; s_sound uuid; s_food uuid; s_staff uuid;
  qid uuid;
  d text;
begin
  if uid is null or not public.has_role(ws, array['owner', 'organiser']) then
    raise exception 'Only organisers and owners can load the sample event' using errcode = '42501';
  end if;

  -- Reset: remove ONLY previously loaded sample rows in THIS workspace.
  delete from public.events where workspace_id = ws and demo;
  delete from public.suppliers s
   where s.workspace_id = ws and s.demo
     and not exists (select 1 from public.quotes q2 where q2.supplier_id = s.id);
  delete from public.venues where workspace_id = ws and demo;

  start_at := (date_trunc('day', now() at time zone 'Asia/Hong_Kong') + interval '28 days' + interval '15 hours') at time zone 'Asia/Hong_Kong';
  d := 'Asia/Hong_Kong';

  insert into public.venues (workspace_id, name, address_note, width_cm, depth_cm, demo)
  values (ws, 'Pier 9 Courtyard (sample)', 'Fictional venue for the sample event', 2000, 1500, true) returning id into v;

  insert into public.events (workspace_id, title, type, goals, starts_at, ends_at, timezone, currency, venue_id, capacity, budget_target_minor, status, demo, created_by)
  values (ws, 'Harbour Night Market (sample)', 'Pop-up market',
          'Fictional sample: a one-night market with 30 stalls, a lantern parade and live music. Replace it with your own event or delete it.',
          start_at, start_at + interval '10 hours', d, 'HKD', v, 150, 8000000, 'planning', true, uid)
  returning id into ev;

  insert into public.suppliers (workspace_id, name, category, contact_note, demo) values
    (ws, 'Lantern Co (sample)', 'Decor', 'Fictional. Ref LC-104', true) returning id into s_lantern;
  insert into public.suppliers (workspace_id, name, category, contact_note, demo) values
    (ws, 'Glow Works (sample)', 'Decor', 'Fictional. Ref GW-221', true) returning id into s_glow;
  insert into public.suppliers (workspace_id, name, category, contact_note, demo) values
    (ws, 'Sound Crew (sample)', 'Sound & lighting', 'Fictional. Ref SC-018', true) returning id into s_sound;
  insert into public.suppliers (workspace_id, name, category, contact_note, demo) values
    (ws, 'Night Bites Collective (sample)', 'Catering', 'Fictional. Ref NB-007', true) returning id into s_food;
  insert into public.suppliers (workspace_id, name, category, contact_note, demo) values
    (ws, 'Steady Hands Staffing (sample)', 'Staffing', 'Fictional. Ref SH-330', true) returning id into s_staff;

  -- Quotes. Accepting goes through accept_quote(), so each accepted quote becomes exactly one budget line.
  insert into public.quotes (workspace_id, event_id, supplier_id, amount_minor, scope, status) values
    (ws, ev, s_lantern, 400000, '40 paper lanterns, hanging kit', 'shortlisted'),
    (ws, ev, s_food, 600000, 'Six food stalls, shared power', 'requested'),
    (ws, ev, s_staff, 180000, '6 stewards, 6 hours', 'rejected');
  insert into public.quotes (workspace_id, event_id, supplier_id, amount_minor, scope, status)
    values (ws, ev, s_glow, 320050, '40 lanterns, delivery included', 'shortlisted') returning id into qid;
  perform public.accept_quote(qid);
  insert into public.quotes (workspace_id, event_id, supplier_id, amount_minor, scope, status)
    values (ws, ev, s_sound, 250000, 'PA and lights, 6 hours', 'shortlisted') returning id into qid;
  perform public.accept_quote(qid);

  insert into public.budget_items (workspace_id, event_id, category, name, planned_minor, committed_minor, paid_minor) values
    (ws, ev, 'Venue', 'Courtyard hire', 1200000, 1200000, 600000),
    (ws, ev, 'Marketing', 'Posters and social ads', 300000, 250000, 250000),
    (ws, ev, 'Permits & insurance', 'Event permit and public liability', 150000, 150000, 0);

  insert into public.tasks (workspace_id, event_id, title, status, priority, due_on, assignee_id, created_by) values
    (ws, ev, 'Confirm stage supplier', 'done', 'high', (current_date - 10), uid, uid),
    (ws, ev, 'Apply for the event permit', 'in_progress', 'high', (current_date + 7), uid, uid),
    (ws, ev, 'Print stall signs', 'todo', 'medium', (current_date + 14), null, uid),
    (ws, ev, 'Brief the stewards', 'todo', 'medium', (current_date + 21), null, uid),
    (ws, ev, 'Order first-aid kit', 'todo', 'low', (current_date - 3), uid, uid),
    (ws, ev, 'Collect stallholder insurance papers', 'in_progress', 'medium', (current_date + 10), null, uid),
    (ws, ev, 'Test the lantern lighting', 'todo', 'low', (current_date + 24), null, uid),
    (ws, ev, 'Publish the running order to stallholders', 'todo', 'medium', (current_date + 20), uid, uid);

  insert into public.notes (workspace_id, event_id, body, author_id) values
    (ws, ev, 'Sample note: the stage supplier needs the power plan by next week.', uid);

  insert into public.guests (workspace_id, event_id, name, group_name, party_size, rsvp) values
    (ws, ev, 'Sample party A', 'Friends', 4, 'confirmed'),
    (ws, ev, 'Sample party B', 'Friends', 3, 'confirmed'),
    (ws, ev, 'Sample vendors C', 'Vendors', 12, 'confirmed'),
    (ws, ev, 'Sample vendors D', 'Vendors', 8, 'confirmed'),
    (ws, ev, 'Sample press E', 'Press', 2, 'confirmed'),
    (ws, ev, 'Sample party F', 'Friends', 5, 'tentative'),
    (ws, ev, 'Sample party G', 'Community', 6, 'tentative'),
    (ws, ev, 'Sample party H', 'Community', 10, 'invited'),
    (ws, ev, 'Sample party I', 'Friends', 2, 'invited'),
    (ws, ev, 'Sample party J', 'Friends', 3, 'declined'),
    (ws, ev, 'Sample volunteers K', 'Volunteers', 20, 'confirmed'),
    (ws, ev, 'Sample performers L', 'Performers', 9, 'confirmed');

  insert into public.schedule_entries (workspace_id, event_id, title, starts_at, ends_at, location, owner_id) values
    (ws, ev, 'Stallholder load-in', start_at, start_at + interval '2 hours', 'Gate 2', uid),
    (ws, ev, 'Sound check', start_at + interval '2 hours', start_at + interval '3 hours 30 minutes', 'Stage', null),
    (ws, ev, 'Doors open', start_at + interval '3 hours', start_at + interval '8 hours 30 minutes', 'Main gate', null),
    (ws, ev, 'Live music set 1', start_at + interval '3 hours 30 minutes', start_at + interval '5 hours', 'Stage', null),
    (ws, ev, 'Lantern parade', start_at + interval '5 hours 30 minutes', start_at + interval '6 hours 15 minutes', 'Courtyard', uid),
    (ws, ev, 'Live music set 2', start_at + interval '6 hours 30 minutes', start_at + interval '8 hours', 'Stage', null),
    (ws, ev, 'Last orders', start_at + interval '8 hours', start_at + interval '8 hours 30 minutes', 'Food stalls', null),
    (ws, ev, 'Pack-down', start_at + interval '8 hours', start_at + interval '10 hours', 'Whole site', uid);

  insert into public.layout_items (workspace_id, event_id, kind, label, x_cm, y_cm, w_cm, h_cm) values
    (ws, ev, 'stage', 'Stage', 600, 50, 800, 300),
    (ws, ev, 'entrance', 'Main gate', 900, 1450, 200, 50),
    (ws, ev, 'booth', 'Stall 1', 100, 500, 300, 200),
    (ws, ev, 'booth', 'Stall 2', 100, 800, 300, 200),
    (ws, ev, 'booth', 'Stall 3', 100, 1100, 300, 200),
    (ws, ev, 'booth', 'Stall 4', 1600, 500, 300, 200),
    (ws, ev, 'booth', 'Stall 5', 1600, 800, 300, 200),
    (ws, ev, 'booth', 'Stall 6', 1600, 1100, 300, 200),
    (ws, ev, 'table', 'Seating A', 700, 600, 250, 250),
    (ws, ev, 'table', 'Seating B', 1050, 600, 250, 250),
    (ws, ev, 'other', 'First aid', 800, 1150, 200, 150);

  return ev;
end $$;

-- ------------------------------------------------------------ account deletion

-- Workspaces where I am the ONLY owner and other people are members: deleting my account would orphan them.
create function public.account_deletion_blockers() returns table (workspace_id uuid, name text, other_members bigint)
language sql stable security definer set search_path = '' as $$
  select w.id, w.name,
         (select count(*) from public.workspace_members x where x.workspace_id = w.id and x.user_id <> auth.uid())
  from public.workspaces w
  join public.workspace_members me on me.workspace_id = w.id and me.user_id = auth.uid() and me.role = 'owner'
  where not exists (select 1 from public.workspace_members o where o.workspace_id = w.id and o.role = 'owner' and o.user_id <> auth.uid())
    and exists (select 1 from public.workspace_members x where x.workspace_id = w.id and x.user_id <> auth.uid())
$$;

-- Workspaces where I am the only member (so nobody else's data is involved) are deleted with my account.
create function public.remove_my_sole_workspaces() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from public.workspaces w
   where exists (select 1 from public.workspace_members me where me.workspace_id = w.id and me.user_id = auth.uid() and me.role = 'owner')
     and not exists (select 1 from public.workspace_members o where o.workspace_id = w.id and o.user_id <> auth.uid());
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- privileges

revoke execute on function public.check_venue_fits_layout() from public, anon, authenticated;
revoke execute on function
  public.save_layout(uuid, jsonb, uuid[]), public.reset_demo(uuid),
  public.account_deletion_blockers(), public.remove_my_sole_workspaces()
  from public, anon;
grant execute on function
  public.save_layout(uuid, jsonb, uuid[]), public.reset_demo(uuid),
  public.account_deletion_blockers(), public.remove_my_sole_workspaces()
  to authenticated;
