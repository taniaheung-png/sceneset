import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { demoViews, sample } from "@/lib/sampleData";

export function generateStaticParams() {
  return demoViews.map((v) => ({ view: v.slug }));
}

export default async function DemoView({ params }: PageProps<"/demo/[view]">) {
  const { view } = await params;
  const v = demoViews.find((x) => x.slug === view);
  if (!v) notFound();
  return (
    <>
      <PageHeader event={sample.event.title} title={v.label} />
      <section className="max-w-prose rounded-lg border border-rule bg-surface p-6">
        <StatusChip tone="warn">Not built yet</StatusChip>
        <h2 className="mt-3 text-lg font-bold">This view is planned for implementation phase {v.phase}</h2>
        <p className="mt-2 text-ink-2">
          The navigation shell is in place so the structure can be reviewed. The {v.label.toLowerCase()} itself is not
          implemented, and nothing on this page is functional.
        </p>
        <div className="mt-4">
          <ButtonLink href="/demo" variant="secondary">Back to dashboard preview</ButtonLink>
        </div>
      </section>
    </>
  );
}
