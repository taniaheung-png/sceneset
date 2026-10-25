// STATIC, FICTIONAL preview data for Phase 1. Replaced by real saved records from Phase 3 onward.
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
  budget: { targetMinor: 8_000_000, plannedMinor: 7_200_000, committedMinor: 6_130_000, paidMinor: 2_500_000 },
  tasks: { open: 14, overdue: 3, done: 9 },
  guests: { invited: 96, confirmed: 54, tentative: 11, declined: 7 },
  runOfShow: [
    { time: "15:00", title: "Stallholder load-in", owner: "Ming" },
    { time: "17:30", title: "Sound check", owner: "Priya" },
    { time: "18:00", title: "Doors open", owner: "Jonas" },
    { time: "19:30", title: "Lantern parade", owner: "Ming" },
    { time: "23:30", title: "Pack-down", owner: "Jonas" },
  ],
  readiness: [
    { label: "Venue chosen", done: true },
    { label: "Budget target set", done: true },
    { label: "Supplier quote accepted", done: true },
    { label: "Key tasks complete", done: false },
    { label: "Running order drafted", done: true },
    { label: "Layout saved", done: false },
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
