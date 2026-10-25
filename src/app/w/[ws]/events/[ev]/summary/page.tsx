import type { Metadata } from "next";
import { SummaryView } from "@/components/events/SummaryView";
import { loadPlan } from "@/lib/plan";

export const metadata: Metadata = { title: "Event summary" };

export default async function Summary({ params }: PageProps<"/w/[ws]/events/[ev]/summary">) {
  const { ws, ev } = await params;
  // Workspace access is enforced inside getEvent (called by loadPlan): other workspaces and malformed ids get a plain 404.
  const plan = await loadPlan(ws, ev);
  return <SummaryView plan={plan} base={`/w/${ws}/events/${ev}`} />;
}
