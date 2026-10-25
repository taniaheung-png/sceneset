-- SceneSet 004: sandbox entitlement log. TEST MODE ONLY: no card data, no money.
-- Rows are written only by a server-side function added in phase 7; clients can only read (owners).

create table public.entitlement_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_id uuid,
  plan text not null check (plan in ('event', 'organiser')),
  outcome text not null check (outcome in ('success', 'cancelled', 'failed')),
  idempotency_key text not null unique,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (event_id, workspace_id) references public.events (id, workspace_id) on delete cascade
);
create index entitlement_workspace_idx on public.entitlement_events (workspace_id, created_at);

alter table public.entitlement_events enable row level security;
revoke all on public.entitlement_events from anon, authenticated;
grant select on public.entitlement_events to authenticated;
create policy entitlement_select on public.entitlement_events for select to authenticated
  using (public.has_role(workspace_id, array['owner']));
