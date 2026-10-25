import { DashboardView } from "@/components/events/DashboardView";
import { PageHeader } from "@/components/shell/PageHeader";
import { demoPlan } from "@/lib/demoData";
import { buildPlan } from "@/lib/plan";

// Public, read-only, fictional. No login, no database, nothing here can be saved.
export default function DemoDashboard() {
  const plan = buildPlan(demoPlan());
  return (
    <>
      <PageHeader event="Sample event" title="Dashboard" />
      <DashboardView plan={plan} base="/demo" readOnly />
    </>
  );
}
