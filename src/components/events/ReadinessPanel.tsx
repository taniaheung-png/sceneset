import Link from "next/link";
import { CheckIcon } from "@/components/ui/icons";
import { READINESS_NOTE, type readiness } from "@/lib/readiness";

/** The readiness checklist: every incomplete item links to the view that fixes it (unless `links` is false, e.g. in print). */
export function ReadinessPanel({ r, base, links = true }: { r: ReturnType<typeof readiness>; base: string; links?: boolean }) {
  return (
    <section aria-labelledby="d-ready" className="panel min-w-0">
      <div className="panel-head">
        <div>
          <h2 id="d-ready" className="panel-title">Readiness</h2>
          <p className="num text-[0.8125rem] text-ink-2" data-readiness={r.percent}>
            <strong className="text-navy">{r.passed} of {r.total}</strong> checks passed ({r.percent}%)
          </p>
        </div>
      </div>
      <div className="panel-body">
        <div aria-hidden className="mb-3 h-[0.3125rem] overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-sage" style={{ width: `${r.percent}%` }} />
        </div>
        <ul className="flex flex-col gap-2">
          {r.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 text-sm" data-check={c.id} data-done={c.done}>
              {c.done ? (
                <span className="tile tile-sage mt-px !size-5 !rounded-full"><CheckIcon width={12} height={12} strokeWidth={2.6} /></span>
              ) : (
                <span aria-hidden className="mt-px size-5 shrink-0 rounded-full border-2 border-control" />
              )}
              <span className="min-w-0">
                <span className="font-semibold text-navy">{c.label}</span>
                <span className="sr-only">{c.done ? " (done)" : " (not done)"}</span>
                {!c.done && (
                  <span className="block text-[0.8125rem] text-ink-2">
                    {c.hint}{" "}
                    {links && (
                      <Link href={c.view ? `${base}/${c.view}` : base} className="font-semibold text-primary underline">
                        Fix this
                      </Link>
                    )}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-ink-2">
          Each check counts equally, so the percentage is checks passed divided by {r.total}. A check that needs data (for example
          &ldquo;nothing overdue&rdquo; needs tasks) fails until the data exists, so an empty plan scores 0%. {READINESS_NOTE}
        </p>
      </div>
    </section>
  );
}
