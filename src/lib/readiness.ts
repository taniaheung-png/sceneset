// Readiness checklist: a planning aid built from what is actually saved. It is NOT a safety, legal or
// compliance certification.
//
// Percentage = checks passed / total checks, every check weighted equally. A check that needs data (for example
// "nothing overdue" needs at least one task) FAILS while that data does not exist, so an empty plan scores 0%
// and can never look fully ready.

export type ReadinessInput = {
  hasVenue: boolean;
  hasTarget: boolean;
  budgetLines: number;
  overBudget: boolean;
  tasks: number;
  overdueTasks: number;
  quotes: number;
  undecidedQuotes: number;
  guests: number;
  capacity: number | null;
  overCapacity: boolean;
  entries: number;
  ownerClashes: number;
  layoutItems: number;
};

/** `view` is the event section that fixes the item: "" dashboard, or tasks, suppliers, budget, guests, schedule, layout, edit. */
export type Check = { id: string; label: string; done: boolean; hint: string; view: string };

export function readiness(i: ReadinessInput): { checks: Check[]; passed: number; total: number; percent: number } {
  const budgetReady = i.hasTarget && i.budgetLines > 0;
  const checks: Check[] = [
    { id: "venue", label: "Venue chosen", done: i.hasVenue, hint: "Choose or add a venue.", view: "layout" },
    { id: "budget-setup", label: "Budget set up", done: budgetReady, hint: i.hasTarget ? "Add at least one budget line." : "Set a budget target (Edit event) and add budget lines.", view: i.hasTarget ? "budget" : "edit" },
    { id: "within-budget", label: "Within budget", done: budgetReady && !i.overBudget, hint: i.overBudget ? "Committed spending is above the target." : "Needs a target and budget lines first.", view: "budget" },
    { id: "tasks", label: "Tasks planned", done: i.tasks > 0, hint: "Add the tasks that need doing.", view: "tasks" },
    { id: "overdue", label: "Nothing overdue", done: i.tasks > 0 && i.overdueTasks === 0, hint: i.overdueTasks > 0 ? `${i.overdueTasks} task${i.overdueTasks === 1 ? " is" : "s are"} overdue.` : "Needs tasks first.", view: "tasks" },
    { id: "quotes", label: "Supplier quotes decided", done: i.quotes > 0 && i.undecidedQuotes === 0, hint: i.undecidedQuotes > 0 ? `${i.undecidedQuotes} quote${i.undecidedQuotes === 1 ? " is" : "s are"} still awaiting a decision.` : "Record and decide at least one supplier quote.", view: "suppliers" },
    { id: "guests", label: "Guest list started", done: i.guests > 0, hint: "Add the guests or parties you are inviting.", view: "guests" },
    { id: "capacity", label: "Attendance within capacity", done: i.capacity !== null && i.guests > 0 && !i.overCapacity, hint: i.capacity === null ? "Set a capacity (Edit event)." : i.overCapacity ? "Confirmed guests are above capacity." : "Needs guests first.", view: i.capacity === null ? "edit" : "guests" },
    { id: "run-of-show", label: "Running order drafted", done: i.entries > 0, hint: "Add the timed activities for the day.", view: "schedule" },
    { id: "clashes", label: "No same-person clashes", done: i.entries > 0 && i.ownerClashes === 0, hint: i.ownerClashes > 0 ? "Someone is responsible for overlapping activities." : "Needs a running order first.", view: "schedule" },
    { id: "layout", label: "Venue layout saved", done: i.layoutItems > 0, hint: "Place tables, stage and entrances on the layout.", view: "layout" },
  ];
  const passed = checks.filter((c) => c.done).length;
  return { checks, passed, total: checks.length, percent: Math.round((passed / checks.length) * 100) };
}

export const READINESS_NOTE =
  "Readiness is a planning aid built from what is saved here. It is not a safety, legal or compliance certification.";
