import { PageHeader } from "@/components/shell/PageHeader";
import { CueTab } from "@/components/ui/CueTab";
import { CheckIcon, CircleIcon } from "@/components/ui/icons";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatMinor } from "@/lib/money";
import { sample } from "@/lib/sampleData";

const card = "rounded-lg border border-rule bg-surface p-5";

export default function DemoDashboard() {
  const { event, budget, tasks, guests, runOfShow, readiness } = sample;
  const money = (m: number) => formatMinor(m, event.currency);
  const remaining = budget.targetMinor - budget.committedMinor;
  const used = Math.min(100, Math.round((budget.committedMinor / budget.targetMinor) * 100));
  const passed = readiness.filter((r) => r.done).length;
  const headcount = guests.confirmed;

  return (
    <>
      <PageHeader event="Sample event" title="Dashboard" />

      <section aria-label="Event summary" className="flex items-center gap-4">
        <CueTab date={event.date} />
        <div>
          <h2 className="text-xl font-bold">{event.title}</h2>
          <p className="text-ink-2">{event.venue}</p>
          <div className="mt-1"><StatusChip tone="info">{event.status}</StatusChip></div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="d-ready" className={card}>
          <h2 id="d-ready" className="text-lg font-bold">Readiness</h2>
          <p className="num text-sm text-ink-2">{passed} of {readiness.length} checks passed</p>
          <ul className="mt-3 flex flex-col gap-2">
            {readiness.map((r) => (
              <li key={r.label} className="flex items-center gap-2 text-sm">
                {r.done ? <CheckIcon className="text-success" /> : <CircleIcon className="text-ink-2" />}
                <span>{r.label}</span>
                <span className="sr-only">{r.done ? "(done)" : "(not done)"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="d-budget" className={card}>
          <h2 id="d-budget" className="text-lg font-bold">Budget</h2>
          <dl className="num mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-2">Target</dt><dd className="text-right">{money(budget.targetMinor)}</dd>
            <dt className="text-ink-2">Committed</dt><dd className="text-right">{money(budget.committedMinor)}</dd>
            <dt className="text-ink-2">Paid</dt><dd className="text-right">{money(budget.paidMinor)}</dd>
            <dt className="text-ink-2">Outstanding</dt><dd className="text-right">{money(budget.committedMinor - budget.paidMinor)}</dd>
            <dt className="font-semibold">Remaining</dt><dd className="text-right font-semibold">{money(remaining)}</dd>
          </dl>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${used}% of target committed`}>
            <div className="h-full bg-primary" style={{ width: `${used}%` }} />
          </div>
        </section>

        <section aria-labelledby="d-tasks" className={card}>
          <h2 id="d-tasks" className="text-lg font-bold">Tasks</h2>
          <p className="num mt-2 text-sm"><strong>{tasks.open}</strong> open, <strong>{tasks.done}</strong> done</p>
          <p className="mt-2"><StatusChip tone="danger">{tasks.overdue} overdue</StatusChip></p>
        </section>

        <section aria-labelledby="d-guests" className={card}>
          <h2 id="d-guests" className="text-lg font-bold">Guests</h2>
          <p className="num mt-2 text-sm">
            <strong>{headcount}</strong> confirmed of <strong>{event.capacity}</strong> capacity
          </p>
          <p className="num mt-1 text-sm text-ink-2">
            {guests.invited} invited, {guests.tentative} tentative, {guests.declined} declined
          </p>
        </section>
      </div>

      <section aria-labelledby="d-ros" className={card}>
        <h2 id="d-ros" className="text-lg font-bold">Run of show</h2>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">Sample running order</caption>
          <thead className="bg-sunken">
            <tr>
              <th scope="col" className="px-3 py-2">Time</th>
              <th scope="col" className="px-3 py-2">Activity</th>
              <th scope="col" className="px-3 py-2">Owner</th>
            </tr>
          </thead>
          <tbody>
            {runOfShow.map((r) => (
              <tr key={r.time} className="border-t border-rule">
                <td className="num px-3 py-2">{r.time}</td>
                <td className="px-3 py-2">{r.title}</td>
                <td className="px-3 py-2">{r.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
