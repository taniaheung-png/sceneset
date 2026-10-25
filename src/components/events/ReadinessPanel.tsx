import Link from "next/link";
import { CheckIcon, CircleIcon } from "@/components/ui/icons";
import { READINESS_NOTE, type readiness } from "@/lib/readiness";

/** The readiness checklist: every incomplete item links to the view that fixes it (unless `links` is false, e.g. in print). */
export function ReadinessPanel({ r, base, links = true }: { r: ReturnType<typeof readiness>; base: string; links?: boolean }) {
  return (
    <section aria-labelledby="d-ready" className="min-w-0 rounded-lg border border-rule bg-surface p-5">
      <h2 id="d-ready" className="text-lg font-bold">Readiness</h2>
      <p className="num text-sm" data-readiness={r.percent}>
        <strong>{r.passed} of {r.total}</strong> checks passed ({r.percent}%)
      </p>
      <p className="mt-1 text-xs text-ink-2">
        Each check counts equally, so the percentage is checks passed divided by {r.total}. A check that needs data (for
        example &ldquo;nothing overdue&rdquo; needs tasks) fails until the data exists, so an empty plan scores 0%.{" "}
        {READINESS_NOTE}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {r.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm" data-check={c.id} data-done={c.done}>
            {c.done ? <CheckIcon className="mt-0.5 shrink-0 text-success" /> : <CircleIcon className="mt-0.5 shrink-0 text-ink-2" />}
            <span>
              <span className="font-semibold">{c.label}</span>
              <span className="sr-only">{c.done ? " (done)" : " (not done)"}</span>
              {!c.done && (
                <span className="block text-ink-2">
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
    </section>
  );
}
