-- SceneSet 003: suppliers, quotes, budget items (+ RLS). Owner/organiser write; all members read.
-- Money is integer minor units. A supplier with quotes cannot be deleted (history preserved).
-- Accepting a quote into a budget item is an explicit RPC added in phase 4; here the schema makes
-- double-linking impossible (budget_items.quote_id is UNIQUE).

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null default 'other' check (char_length(category) between 1 and 40),
  contact_note text not null default '' check (char_length(contact_note) <= 300),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  event_id uuid not null,
  supplier_id uuid not null,
  amount_minor bigint not null check (amount_minor >= 0),
  scope text not null default '' check (char_length(scope) <= 1000),
  status text not null default 'requested' check (status in ('requested', 'shortlisted', 'accepted', 'rejected')),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id),
  foreign key (event_id, workspace_id) references public.events (id, workspace_id) on delete cascade,
  foreign key (supplier_id, workspace_id) references public.suppliers (id, workspace_id) on delete restrict
);
create index quotes_event_idx on public.quotes (event_id);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  event_id uuid not null,
  category text not null check (char_length(category) between 1 and 40),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  planned_minor bigint not null default 0 check (planned_minor >= 0),
  committed_minor bigint not null default 0 check (committed_minor >= 0),
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  quote_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_minor <= committed_minor),
  foreign key (event_id, workspace_id) references public.events (id, workspace_id) on delete cascade,
  -- The linked quote must belong to the same event; deleting the quote unlinks the item.
  foreign key (quote_id, event_id) references public.quotes (id, event_id) on delete set null (quote_id)
);
create index budget_event_idx on public.budget_items (event_id, category);

do $$
declare t text;
begin
  foreach t in array array['suppliers', 'quotes', 'budget_items'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(workspace_id, array[''owner'',''organiser'']))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(workspace_id, array[''owner'',''organiser''])) with check (public.has_role(workspace_id, array[''owner'',''organiser'']))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_role(workspace_id, array[''owner'',''organiser'']))', t || '_delete', t);
  end loop;
end $$;

grant insert (workspace_id, name, category, contact_note, notes) on public.suppliers to authenticated;
grant update (name, category, contact_note, notes) on public.suppliers to authenticated;

grant insert (workspace_id, event_id, supplier_id, amount_minor, scope, status, notes) on public.quotes to authenticated;
grant update (supplier_id, amount_minor, scope, status, notes) on public.quotes to authenticated;

-- quote_id is set only by the phase-4 accept RPC, never by direct client writes.
grant insert (workspace_id, event_id, category, name, planned_minor, committed_minor, paid_minor) on public.budget_items to authenticated;
grant update (category, name, planned_minor, committed_minor, paid_minor) on public.budget_items to authenticated;
