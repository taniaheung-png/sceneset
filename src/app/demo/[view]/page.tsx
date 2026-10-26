import { notFound } from "next/navigation";
import { SummaryView } from "@/components/events/SummaryView";
import { LayoutLegend, LayoutSvg } from "@/components/layout/LayoutSvg";
import { PageHeader } from "@/components/shell/PageHeader";
import { demoPlan } from "@/lib/demoData";
import { buildPlan } from "@/lib/plan";
import { demoViews } from "@/lib/sampleData";

export function generateStaticParams() {
  return demoViews.map((v) => ({ view: v.slug }));
}

// Each demo view is the same read-only content the signed-in pages show, from the fixed fictional dataset.
const SECTIONS: Record<string, string[] | undefined> = {
  tasks: ["tasks"],
  budget: ["budget"],
  suppliers: ["suppliers"],
  guests: ["guests"],
  schedule: ["ros"],
  layout: ["layout"],
  summary: undefined,
};

export default async function DemoView({ params }: PageProps<"/demo/[view]">) {
  const { view } = await params;
  const v = demoViews.find((x) => x.slug === view);
  if (!v) notFound();
  const plan = buildPlan(demoPlan());
  return (
    <>
      <PageHeader event={plan.event.title} title={v.label} />
      <p className="rounded-md bg-sunken p-3 text-sm text-ink-2">
        Read-only view of fictional sample data. In a real workspace this screen has forms to add and edit; here nothing can be changed or saved.
      </p>
      {view === "layout" && plan.venue ? (
        <section aria-label="Venue layout" className="rounded-lg border border-rule bg-surface p-5">
          <h2 className="text-lg font-bold">{plan.venue.name}</h2>
          <div className="mt-3 max-w-3xl">
            <LayoutSvg room={{ w: plan.venue.width_cm, d: plan.venue.depth_cm }} items={plan.layout} label={`Sample layout, ${plan.layout.length} objects`} />
            <LayoutLegend />
          </div>
        </section>
      ) : (
        <SummaryView plan={plan} base="/demo" only={SECTIONS[view]} />
      )}
    </>
  );
}
