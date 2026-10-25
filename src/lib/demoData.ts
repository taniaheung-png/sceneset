import type { RawPlan } from "./plan";
import { todayIn, zonedLocalToInstant } from "./time";
import type { BudgetRow, GuestRow, LayoutItemRow, QuoteRow, ScheduleRow, TaskRow } from "./types";

// The fixed FICTIONAL sample event behind the public read-only demo. It mirrors what the signed-in "Load a sample
// event" action (reset_demo in supabase/migrations/20261026000006) writes to a workspace, so the demo shows what a
// real workspace will look like. Every name, venue and amount is invented. Dates are relative to the day it is viewed.
const TZ = "Asia/Hong_Kong";
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function demoPlan(now: Date = new Date()): RawPlan {
  const today = todayIn(TZ, now);
  const start = zonedLocalToInstant(`${addDays(today, 28)}T15:00`, TZ)!;
  const at = (h: number) => new Date(start.getTime() + h * 3_600_000).toISOString();
  const v = "demo";
  const venue = { id: "demo-venue", name: "Pier 9 Courtyard (sample)", address_note: "Fictional venue for the sample event", width_cm: 2000, depth_cm: 1500, updated_at: v };

  const task = (id: string, title: string, status: TaskRow["status"], priority: TaskRow["priority"], due: number, mine: boolean): TaskRow => ({
    id, title, description: "", status, priority, due_on: addDays(today, due), assignee_id: mine ? "you" : null, updated_at: v,
  });
  const tasks = [
    task("t1", "Confirm stage supplier", "done", "high", -10, true),
    task("t2", "Apply for the event permit", "in_progress", "high", 7, true),
    task("t3", "Print stall signs", "todo", "medium", 14, false),
    task("t4", "Brief the stewards", "todo", "medium", 21, false),
    task("t5", "Order first-aid kit", "todo", "low", -3, true),
    task("t6", "Collect stallholder insurance papers", "in_progress", "medium", 10, false),
    task("t7", "Test the lantern lighting", "todo", "low", 24, false),
    task("t8", "Publish the running order to stallholders", "todo", "medium", 20, true),
  ];

  const sup = (id: string, name: string, category: string) => ({ id, name, category });
  const quote = (id: string, s: ReturnType<typeof sup>, amount: number, scope: string, status: QuoteRow["status"]): QuoteRow => ({
    id, supplier_id: s.id, amount_minor: amount, scope, status, notes: "", updated_at: v, suppliers: s,
  });
  const quotes = [
    quote("q1", sup("s1", "Lantern Co (sample)", "Decor"), 400000, "40 paper lanterns, hanging kit", "shortlisted"),
    quote("q2", sup("s2", "Glow Works (sample)", "Decor"), 320050, "40 lanterns, delivery included", "accepted"),
    quote("q3", sup("s3", "Sound Crew (sample)", "Sound & lighting"), 250000, "PA and lights, 6 hours", "accepted"),
    quote("q4", sup("s4", "Night Bites Collective (sample)", "Catering"), 600000, "Six food stalls, shared power", "requested"),
    quote("q5", sup("s5", "Steady Hands Staffing (sample)", "Staffing"), 180000, "6 stewards, 6 hours", "rejected"),
  ];

  const line = (id: string, category: string, name: string, planned: number, committed: number, paid: number, quote_id: string | null = null): BudgetRow => ({
    id, category, name, planned_minor: planned, committed_minor: committed, paid_minor: paid, quote_id, updated_at: v,
  });
  const budget = [
    line("b1", "Decor", "Glow Works (sample)", 320050, 320050, 0, "q2"),
    line("b2", "Marketing", "Posters and social ads", 300000, 250000, 250000),
    line("b3", "Permits & insurance", "Event permit and public liability", 150000, 150000, 0),
    line("b4", "Sound & lighting", "Sound Crew (sample)", 250000, 250000, 0, "q3"),
    line("b5", "Venue", "Courtyard hire", 1200000, 1200000, 600000),
  ];

  const guest = (id: string, name: string, group: string, party: number, rsvp: GuestRow["rsvp"]): GuestRow => ({
    id, name, contact: null, group_name: group, party_size: party, rsvp, notes: "", updated_at: v,
  });
  const guests = [
    guest("g1", "Sample party A", "Friends", 4, "confirmed"),
    guest("g2", "Sample party B", "Friends", 3, "confirmed"),
    guest("g3", "Sample vendors C", "Vendors", 12, "confirmed"),
    guest("g4", "Sample vendors D", "Vendors", 8, "confirmed"),
    guest("g5", "Sample press E", "Press", 2, "confirmed"),
    guest("g6", "Sample party F", "Friends", 5, "tentative"),
    guest("g7", "Sample party G", "Community", 6, "tentative"),
    guest("g8", "Sample party H", "Community", 10, "invited"),
    guest("g9", "Sample party I", "Friends", 2, "invited"),
    guest("g10", "Sample party J", "Friends", 3, "declined"),
    guest("g11", "Sample volunteers K", "Volunteers", 20, "confirmed"),
    guest("g12", "Sample performers L", "Performers", 9, "confirmed"),
  ];

  const entry = (id: string, title: string, from: number, to: number, location: string, mine: boolean): ScheduleRow => ({
    id, title, starts_at: at(from), ends_at: at(to), location, owner_id: mine ? "you" : null, notes: "", updated_at: v,
  });
  const entries = [
    entry("e1", "Stallholder load-in", 0, 2, "Gate 2", true),
    entry("e2", "Sound check", 2, 3.5, "Stage", false),
    entry("e3", "Doors open", 3, 8.5, "Main gate", false),
    entry("e4", "Live music set 1", 3.5, 5, "Stage", false),
    entry("e5", "Lantern parade", 5.5, 6.25, "Courtyard", true),
    entry("e6", "Live music set 2", 6.5, 8, "Stage", false),
    entry("e7", "Last orders", 8, 8.5, "Food stalls", false),
    entry("e8", "Pack-down", 8, 10, "Whole site", true),
  ];

  const item = (id: string, kind: LayoutItemRow["kind"], label: string, x: number, y: number, w: number, h: number): LayoutItemRow => ({
    id, kind, label, x_cm: x, y_cm: y, w_cm: w, h_cm: h, updated_at: v,
  });
  const layout = [
    item("l1", "stage", "Stage", 600, 50, 800, 300),
    item("l2", "entrance", "Main gate", 900, 1450, 200, 50),
    item("l3", "booth", "Stall 1", 100, 500, 300, 200),
    item("l4", "booth", "Stall 2", 100, 800, 300, 200),
    item("l5", "booth", "Stall 3", 100, 1100, 300, 200),
    item("l6", "booth", "Stall 4", 1600, 500, 300, 200),
    item("l7", "booth", "Stall 5", 1600, 800, 300, 200),
    item("l8", "booth", "Stall 6", 1600, 1100, 300, 200),
    item("l9", "table", "Seating A", 700, 600, 250, 250),
    item("l10", "table", "Seating B", 1050, 600, 250, 250),
    item("l11", "other", "First aid", 800, 1150, 200, 150),
  ];

  return {
    event: {
      id: "demo-event", workspace_id: "demo", title: "Harbour Night Market (sample)", type: "Pop-up market",
      goals: "Fictional sample: a one-night market with 30 stalls, a lantern parade and live music.",
      starts_at: at(0), ends_at: at(10), timezone: TZ, currency: "HKD", venue_id: venue.id, capacity: 150,
      budget_target_minor: 8_000_000, status: "planning", archived_at: null, updated_at: v, demo: true, event_upgrade: false,
      venues: { id: venue.id, name: venue.name },
    },
    tasks, budget, quotes, guests, entries, layout, venue,
    members: [{ user_id: "you", display_name: "You (sample)" }],
  };
}
