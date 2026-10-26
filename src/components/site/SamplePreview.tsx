import { CueTab } from "@/components/ui/CueTab";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatMinor } from "@/lib/money";
import { sample } from "@/lib/sampleData";

/** Static picture of the product built from sample data. Not interactive and not saved anywhere. */
export function SamplePreview() {
  const { event, budget, runOfShow, readiness } = sample;
  const used = Math.round((budget.committedMinor / budget.targetMinor) * 100);
  const passed = readiness.filter((r) => r.done).length;
  return (
    <figure className="m-0">
      <div className="panel overflow-hidden shadow-2" role="img"
        aria-label={`Illustration of an event plan: ${event.title}, ${passed} of ${readiness.length} readiness checks passed, ${used} percent of budget committed. Fictional sample data.`}>
        <div className="flex items-center gap-4 border-b border-rule p-4" aria-hidden>
          <CueTab date={event.date} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-navy">{event.title}</p>
            <p className="truncate text-sm text-ink-2">{event.venue}</p>
          </div>
          <div className="ml-auto hidden sm:block"><StatusChip tone="info">{event.status}</StatusChip></div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[1.2fr_1fr]" aria-hidden>
          <ul className="flex flex-col text-sm">
            {runOfShow.slice(0, 4).map((r) => (
              <li key={r.time} className="flex gap-3 border-t border-rule py-2 first:border-t-0 first:pt-0">
                <span className="num w-12 shrink-0 font-semibold">{r.time}</span>
                <span className="truncate">{r.title}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-ink-2">Budget committed</p>
              <p className="num font-semibold">{formatMinor(budget.committedMinor, event.currency)}</p>
              <div className="mt-1.5 h-[0.3125rem] overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-coral" style={{ width: `${used}%` }} /></div>
            </div>
            <div>
              <p className="text-ink-2">Readiness</p>
              <p className="num font-semibold">{passed} of {readiness.length} checks</p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-sm text-ink-2">Static illustration with fictional sample data. Not a working screen.</figcaption>
    </figure>
  );
}
