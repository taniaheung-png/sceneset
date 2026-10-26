// STATIC, FICTIONAL preview data for the landing-page product preview and the demo navigation labels. The demo pages themselves
// build their plan from src/lib/demoData.ts through the same rules as the signed-in app.
// All names, venues and amounts are invented. Amounts are minor units (HKD cents).
export const sample = {
  event: {
    title: "Harbour Night Market",
    date: "2026-11-14",
    venue: "Pier 9 Courtyard (fictional)",
    status: "Planning",
    capacity: 150,
    currency: "HKD",
  },
  budget: { targetMinor: 8_000_000, plannedMinor: 7_200_000, committedMinor: 2_170_050, paidMinor: 500_000 },
  tasks: { open: 14, overdue: 3, done: 9 },
  guests: { invited: 96, confirmed: 54, tentative: 11, declined: 7 },
  runOfShow: [
    { time: "15:00", title: "Stallholder load-in", owner: "Ming" },
    { time: "17:30", title: "Sound check", owner: "Priya" },
    { time: "18:00", title: "Doors open", owner: "Jonas" },
    { time: "19:30", title: "Lantern parade", owner: "Ming" },
    { time: "23:30", title: "Pack-down", owner: "Jonas" },
  ],
  // The same eleven checks the product uses; 9 of 11 matches the read-only demo.
  readiness: [
    { label: "Venue chosen", done: true },
    { label: "Budget set up", done: true },
    { label: "Within budget", done: true },
    { label: "Tasks planned", done: true },
    { label: "Nothing overdue", done: false },
    { label: "Supplier quotes decided", done: false },
    { label: "Guest list started", done: true },
    { label: "Attendance within capacity", done: true },
    { label: "Running order drafted", done: true },
    { label: "No same-person clashes", done: true },
    { label: "Venue layout saved", done: true },
  ],
};

export const demoViews = [
  { slug: "tasks", label: "Task board", phase: 3 },
  { slug: "budget", label: "Budget", phase: 4 },
  { slug: "suppliers", label: "Suppliers & quotes", phase: 4 },
  { slug: "guests", label: "Guests", phase: 5 },
  { slug: "schedule", label: "Run of show", phase: 5 },
  { slug: "layout", label: "Venue layout", phase: 6 },
  { slug: "summary", label: "Print summary", phase: 6 },
] as const;
