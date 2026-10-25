import { cache } from "react";
import { type BudgetLine, budgetTotals } from "./budget";
import { getEvent, getMembers } from "./events";
import { guestSummary } from "./guests";
import { readiness } from "./readiness";
import { entryWarnings, sortEntries } from "./schedule";
import { createClient } from "./supabase/server";
import { todayIn } from "./time";
import type { BudgetRow, EventRow, GuestRow, LayoutItemRow, MemberRow, QuoteRow, ScheduleRow, TaskRow, VenueRow } from "./types";

export type RawPlan = {
  event: EventRow;
  tasks: TaskRow[];
  budget: BudgetRow[];
  quotes: QuoteRow[];
  guests: GuestRow[];
  entries: ScheduleRow[];
  layout: LayoutItemRow[];
  venue: VenueRow | null;
  members: Pick<MemberRow, "user_id" | "display_name">[];
};

/**
 * Pure: turns saved rows into the summaries the dashboard and the print summary show. The real app and the public
 * read-only demo both call this, so they use exactly the same arithmetic and rules.
 */
export function buildPlan(raw: RawPlan, now: Date = new Date()) {
  const { event } = raw;
  const entries = sortEntries(raw.entries);
  const totals = budgetTotals(raw.budget as BudgetLine[], event.budget_target_minor);
  const gs = guestSummary(raw.guests, event.capacity);
  const entryChecks = entryWarnings(entries, event.starts_at, event.ends_at);
  const today = todayIn(event.timezone, now);
  const overdue = raw.tasks.filter((t) => t.status !== "done" && t.due_on !== null && t.due_on < today);
  const undecided = raw.quotes.filter((q) => q.status === "requested" || q.status === "shortlisted").length;
  const ownerClashes = [...entryChecks.values()].filter((w) => w.some((x) => x.kind === "owner-clash")).length;
  const outsideWindow = [...entryChecks.values()].filter((w) => w.some((x) => x.kind.endsWith("window"))).length;
  const ready = readiness({
    hasVenue: Boolean(event.venue_id),
    hasTarget: totals.hasTarget,
    budgetLines: raw.budget.length,
    overBudget: totals.over,
    tasks: raw.tasks.length,
    overdueTasks: overdue.length,
    quotes: raw.quotes.length,
    undecidedQuotes: undecided,
    guests: raw.guests.length,
    capacity: event.capacity,
    overCapacity: gs.over,
    entries: entries.length,
    ownerClashes,
    layoutItems: raw.layout.length,
  });
  return { ...raw, entries, totals, gs, entryChecks, today, overdue, undecided, ownerClashes, outsideWindow, ready };
}
export type Plan = ReturnType<typeof buildPlan>;

/**
 * Everything about one event, loaded once per request, with the shared summaries computed from it.
 * shortcut: loads every row of the event; fine at prototype scale, switch to count queries beyond ~1,000 rows per table.
 */
export const loadPlan = cache(async (ws: string, ev: string) => {
  const ctx = await getEvent(ws, ev);
  const { event } = ctx;
  const supabase = await createClient();
  const [tasks, budget, quotes, guests, sched, layout, venue, members] = await Promise.all([
    supabase.from("tasks").select("id, title, description, status, priority, due_on, assignee_id, updated_at").eq("event_id", ev),
    supabase.from("budget_items").select("id, category, name, planned_minor, committed_minor, paid_minor, quote_id, updated_at").eq("event_id", ev).order("category").order("name"),
    supabase.from("quotes").select("id, supplier_id, amount_minor, scope, status, notes, updated_at, suppliers(id, name, category)").eq("event_id", ev).order("amount_minor"),
    supabase.from("guests").select("id, name, contact, group_name, party_size, rsvp, notes, updated_at").eq("event_id", ev).order("name").order("id"),
    supabase.from("schedule_entries").select("id, title, starts_at, ends_at, location, owner_id, notes, updated_at").eq("event_id", ev),
    supabase.from("layout_items").select("id, kind, label, x_cm, y_cm, w_cm, h_cm, updated_at").eq("event_id", ev).order("label").order("id"),
    event.venue_id
      ? supabase.from("venues").select("id, name, address_note, width_cm, depth_cm, updated_at").eq("id", event.venue_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getMembers(ws),
  ]);
  const plan = buildPlan({
    event,
    tasks: (tasks.data ?? []) as TaskRow[],
    budget: (budget.data ?? []) as BudgetRow[],
    quotes: (quotes.data ?? []) as unknown as QuoteRow[],
    guests: (guests.data ?? []) as GuestRow[],
    entries: (sched.data ?? []) as ScheduleRow[],
    layout: (layout.data ?? []) as LayoutItemRow[],
    venue: (venue.data ?? null) as VenueRow | null,
    members,
  });
  return { ...ctx, ...plan };
});
