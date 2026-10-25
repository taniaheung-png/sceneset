-- SceneSet 005: explicit, idempotent "accept quote -> budget line" and its guard rails.
--
-- Rules enforced here (not just in the UI):
--  * A quote becomes 'accepted' ONLY through accept_quote(), which links it to exactly one budget line
--    (new, or an existing unlinked one). Direct writes that set status 'accepted' are rejected.
--  * Repeating accept_quote() for the same quote returns the same budget line and changes nothing, even
--    under concurrent clicks (the quote row is locked first; budget_items.quote_id is also UNIQUE).
--  * Spending is counted once: totals sum budget_items only. Quotes are never summed.
--  * While accepted, a quote's status/amount/supplier cannot change, and the linked line's committed
--    amount cannot be edited: both come from the quote. reopen_quote() unlinks and reverts to 'shortlisted';
--    deleting a linked budget line also reopens its quote.

create function public.guard_quote_changes() returns trigger
language plpgsql set search_path = '' as $$
declare
  flag text := coalesce(current_setting('sceneset.rpc', true), '');
begin
  if tg_op = 'INSERT' then
    if new.status = 'accepted' then
      raise exception 'Quotes are accepted with the Accept action' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status = 'accepted' and old.status <> 'accepted' and flag <> 'accept' then
    raise exception 'Quotes are accepted with the Accept action' using errcode = '42501';
  end if;
  if old.status = 'accepted' and flag <> 'reopen'
     and (new.status, new.amount_minor, new.supplier_id) is distinct from (old.status, old.amount_minor, old.supplier_id) then
    raise exception 'Re-open this quote before changing its status, amount or supplier' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger quotes_guard before insert or update on public.quotes
  for each row execute function public.guard_quote_changes();

create function public.guard_budget_item_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.quote_id is not null and new.quote_id is not distinct from old.quote_id
     and new.committed_minor <> old.committed_minor then
    raise exception 'The committed amount comes from the accepted quote. Re-open the quote to change it.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger budget_items_guard before update on public.budget_items
  for each row execute function public.guard_budget_item_changes();

-- Deleting a quote-linked budget line puts its quote back to 'shortlisted' so it can be accepted again.
create function public.reopen_quote_on_item_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('sceneset.rpc', 'reopen', true);
  update public.quotes set status = 'shortlisted' where id = old.quote_id and status = 'accepted';
  perform set_config('sceneset.rpc', '', true);
  return old;
end $$;

create trigger budget_items_reopen_quote after delete on public.budget_items
  for each row when (old.quote_id is not null) execute function public.reopen_quote_on_item_delete();

create function public.accept_quote(quote uuid, into_item uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  q record;
  sup record;
  item uuid;
begin
  -- Lock the quote row first: concurrent repeats wait here, then take the idempotent branch below.
  select * into q from public.quotes where id = quote for update;
  if not found or not public.has_role(q.workspace_id, array['owner', 'organiser']) then
    raise exception 'Quote not found, or your role cannot accept quotes' using errcode = '42501';
  end if;

  select id into item from public.budget_items where quote_id = quote;
  if item is not null then
    if into_item is not null and into_item <> item then
      raise exception 'This quote is already linked to a different budget line' using errcode = '23505';
    end if;
    return item; -- repeat click: same line, nothing changed
  end if;

  if q.status not in ('requested', 'shortlisted') then
    raise exception 'Only requested or shortlisted quotes can be accepted' using errcode = 'P0001';
  end if;

  perform set_config('sceneset.rpc', 'accept', true);
  select name, category into sup from public.suppliers where id = q.supplier_id;

  if into_item is null then
    insert into public.budget_items (workspace_id, event_id, category, name, planned_minor, committed_minor, paid_minor, quote_id)
    values (q.workspace_id, q.event_id, left(sup.category, 40), left(sup.name, 120), q.amount_minor, q.amount_minor, 0, quote)
    returning id into item;
  else
    -- Link to an existing line on the same event: its committed amount BECOMES the quote amount (replaced, not added).
    update public.budget_items
       set quote_id = quote, committed_minor = q.amount_minor
     where id = into_item and event_id = q.event_id and quote_id is null
    returning id into item;
    if item is null then
      raise exception 'Budget line not found on this event, or it is already linked to another quote' using errcode = 'P0002';
    end if;
  end if;

  update public.quotes set status = 'accepted' where id = quote;
  perform set_config('sceneset.rpc', '', true);
  return item;
end $$;

create function public.reopen_quote(quote uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  q record;
begin
  select * into q from public.quotes where id = quote for update;
  if not found or not public.has_role(q.workspace_id, array['owner', 'organiser']) then
    raise exception 'Quote not found, or your role cannot re-open quotes' using errcode = '42501';
  end if;
  if q.status <> 'accepted' then
    return;
  end if;
  perform set_config('sceneset.rpc', 'reopen', true);
  -- The budget line is kept (it may hold payments); it simply stops being tied to the quote.
  update public.budget_items set quote_id = null where quote_id = quote;
  update public.quotes set status = 'shortlisted' where id = quote;
  perform set_config('sceneset.rpc', '', true);
end $$;

revoke execute on function
  public.guard_quote_changes(), public.guard_budget_item_changes(), public.reopen_quote_on_item_delete()
  from public, anon, authenticated;
revoke execute on function public.accept_quote(uuid, uuid), public.reopen_quote(uuid) from public, anon;
grant execute on function public.accept_quote(uuid, uuid), public.reopen_quote(uuid) to authenticated;
