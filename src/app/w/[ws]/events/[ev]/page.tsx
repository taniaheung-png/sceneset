import type { Metadata } from "next";
import { DashboardView } from "@/components/events/DashboardView";
import { loadPlan } from "@/lib/plan";

export const metadata: Metadata = { title: "Event dashboard" };

const MESSAGES: Record<string, string> = {
  created: "Event created.",
  saved: "Changes saved.",
  sample: "Sample event loaded. It is fictional: explore it, then reset or delete it.",
};

export default async function EventDashboard({ params, searchParams }: PageProps<"/w/[ws]/events/[ev]">) {
  const { ws, ev } = await params;
  const sp = await searchParams;
  // Every number on this page comes from saved rows, via the same pure functions the detail pages and the demo use.
  const plan = await loadPlan(ws, ev);
  return <DashboardView plan={plan} base={`/w/${ws}/events/${ev}`} flash={typeof sp.m === "string" ? MESSAGES[sp.m] : undefined} />;
}
