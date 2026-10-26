import { Fragment } from "react";
import { ReadinessPanel } from "@/components/events/ReadinessPanel";
import { LayoutLegend, LayoutSvg } from "@/components/layout/LayoutSvg";
import { PrintButton } from "@/components/ui/PrintButton";
import { explainRemaining, explainVariance } from "@/lib/budget";
import { EVENT_STATUSES } from "@/lib/eventOptions";
import { RSVPS, rsvpLabel } from "@/lib/guests";
import { cmToMetres, kindLabel } from "@/lib/layout";
import { formatMinor } from "@/lib/money";
import type { Plan } from "@/lib/plan";
import { formatDuration, formatInZone, localDate } from "@/lib/time";

const STATUS_ORDER = { todo: 0, in_progress: 1, done: 2 } as const;
const STATUS_LABEL = { todo: "To do", in_progress: "In progress", done: "Done" } as const;
const H2 = "text-xl font-bold";

/**
 * The event summary: details, readiness, tasks, budget, quotes, guests, running order and layout. Used by the signed-in
 * print route and by the public read-only demo (which can show one section at a time via `only`).
 * Sections not in `only` are rendered `hidden`. shortcut: fine for a small static demo dataset.
 */
export function SummaryView({ plan: p, base, only, branding = true }: { plan: Plan; base: string; only?: string[]; branding?: boolean }) {
  const show = (k: string) => !only || only.includes(k);
  const { event, tasks, budget, quotes, guests, entries, layout, venue, members, totals, gs, entryChecks, ready, today } = p;
  const tz = event.timezone;
  const money = (n: number) => formatMinor(n, event.currency);
  const nameOf = (id: string | null) => (id ? members.find((m) => m.user_id === id)?.display_name || "Unnamed" : "Unassigned");
  const dt = (iso: string) => formatInZone(new Date(iso), tz, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const time = (iso: string) => formatInZone(new Date(iso), tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const day = (iso: string) => formatInZone(new Date(iso), tz, { weekday: "long", day: "numeric", month: "long" });
  const sortedTasks = [...tasks].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") || a.title.localeCompare(b.title));
  const groups = [...new Set(guests.map((g) => g.group_name || "No group"))].sort();
  const th = "px-2 py-1.5";
  const hd = "whitespace-nowrap px-2 py-1.5"; // column headers never break mid-word
  const nw = "whitespace-nowrap px-2 py-1.5"; // short values (due date, priority, status) stay on one line
  const num = "num px-2 py-1.5 text-right";

  return (
    <article className="flex flex-col gap-8 print-area" aria-label="Event summary">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">A printable plan: use your browser&apos;s print dialog to print or save it as a PDF. Navigation and buttons are left out of the printout.</p>
        <PrintButton label="Print this summary" />
      </div>

      {/* The event title, dates, venue and status come from the page header above, which also prints. */}
      <header className="border-b border-ink pb-3" hidden={Boolean(only)}>
        <p className="text-sm font-semibold">Event summary</p>
        <p className="num text-sm">Starts {dt(event.starts_at)}; ends {dt(event.ends_at)} ({tz})</p>
        <p className="text-sm">Status: {EVENT_STATUSES.find(([k]) => k === event.status)?.[1]} · Type: {event.type} · Venue: {event.venues?.name ?? "not set"} · Capacity: {event.capacity ?? "not set"}</p>
        {event.goals && <p className="mt-1 whitespace-pre-line text-sm">Goals: {event.goals}</p>}
      </header>

      <div hidden={Boolean(only)}><ReadinessPanel r={ready} base={base} links={false} /></div>

      <section aria-labelledby="s-tasks" className="print-section" hidden={!show("tasks")}>
        <h2 id="s-tasks" className={H2}>Tasks and responsibilities</h2>
        {tasks.length === 0 ? <p className="mt-1 text-sm text-ink-2">No tasks recorded.</p> : (
          <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm">
            <thead><tr><th scope="col" className={hd}>Task</th><th scope="col" className={hd}>Responsible</th><th scope="col" className={hd}>Due</th><th scope="col" className={hd}>Priority</th><th scope="col" className={hd}>Status</th></tr></thead>
            <tbody>
              {sortedTasks.map((t) => (
                <tr key={t.id} className="border-t border-rule">
                  <th scope="row" className={`${th} font-semibold`}>{t.title}</th>
                  <td className={th}>{nameOf(t.assignee_id)}</td>
                  <td className="num whitespace-nowrap px-2 py-1.5">{t.due_on ?? "None"}{t.status !== "done" && t.due_on && t.due_on < today ? " (overdue)" : ""}</td>
                  <td className={`${nw} capitalize`}>{t.priority}</td>
                  <td className={nw}>{STATUS_LABEL[t.status]}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      <section aria-labelledby="s-budget" className="print-section" hidden={!show("budget")}>
        <h2 id="s-budget" className={H2}>Budget</h2>
        <p className="text-xs text-ink-2">All amounts in {event.currency}. Committed counts each accepted quote once, on its budget line.</p>
        <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm">
          <caption className="sr-only">Budget totals</caption>
          <tbody>
            {[
              ["Budget target", totals.hasTarget ? money(event.budget_target_minor) : "Not set"],
              ["Planned", money(totals.planned)],
              ["Committed (actual or agreed)", money(totals.committed)],
              ["Paid", money(totals.paid)],
              ["Outstanding (committed minus paid)", money(totals.outstanding)],
              [`Remaining against target: ${explainRemaining(totals)}`, totals.remaining === null ? "Not set" : money(totals.remaining)],
              [`Variance (committed minus planned): ${explainVariance(totals)}`, money(totals.variance)],
            ].map(([l, v]) => <tr key={l} className="border-t border-rule"><th scope="row" className={`${th} font-normal`}>{l}</th><td className={`${num} whitespace-nowrap`}>{v}</td></tr>)}
          </tbody>
        </table></div>
        {budget.length > 0 && (
          <div className="overflow-x-auto"><table className="mt-3 w-full text-left text-sm">
            <thead><tr><th scope="col" className={hd}>Category</th><th scope="col" className={hd}>Item</th><th scope="col" className={`${hd} text-right`}>Planned</th><th scope="col" className={`${hd} text-right`}>Committed</th><th scope="col" className={`${hd} text-right`}>Paid</th></tr></thead>
            <tbody>
              {budget.map((b) => <tr key={b.id} className="border-t border-rule"><td className={th}>{b.category}</td><th scope="row" className={`${th} font-semibold`}>{b.name}{b.quote_id ? " (accepted quote)" : ""}</th><td className={`${num} whitespace-nowrap`}>{money(b.planned_minor)}</td><td className={`${num} whitespace-nowrap`}>{money(b.committed_minor)}</td><td className={`${num} whitespace-nowrap`}>{money(b.paid_minor)}</td></tr>)}
            </tbody>
          </table></div>
        )}
      </section>

      <section aria-labelledby="s-suppliers" className="print-section" hidden={!show("suppliers")}>
        <h2 id="s-suppliers" className={H2}>Suppliers and quotes</h2>
        {quotes.length === 0 ? <p className="mt-1 text-sm text-ink-2">No quotes recorded.</p> : (
          <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm">
            <thead><tr><th scope="col" className={hd}>Supplier</th><th scope="col" className={hd}>Category</th><th scope="col" className={`${hd} text-right`}>Quote</th><th scope="col" className={hd}>Status</th><th scope="col" className={hd}>Scope</th></tr></thead>
            <tbody>
              {[...quotes].sort((a, b) => (a.suppliers?.category ?? "").localeCompare(b.suppliers?.category ?? "") || a.amount_minor - b.amount_minor).map((q) => (
                <tr key={q.id} className="border-t border-rule"><th scope="row" className={`${th} font-semibold`}>{q.suppliers?.name}</th><td className={th}>{q.suppliers?.category}</td><td className={`${num} whitespace-nowrap`}>{money(q.amount_minor)}</td><td className={`${nw} capitalize`}>{q.status}</td><td className={th}>{q.scope || "Not stated"}</td></tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      <section aria-labelledby="s-guests" className="print-section" hidden={!show("guests")}>
        <h2 id="s-guests" className={H2}>Guests and headcount</h2>
        <p className="text-xs text-ink-2">A record is one entry; a record can be a party of several people. Attending headcount counts people on confirmed records only. Contact details are left out of this printout.</p>
        <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm">
          <caption className="sr-only">Guest records and people by RSVP status</caption>
          <thead><tr><th scope="col" className={hd}>RSVP</th><th scope="col" className={`${hd} text-right`}>Records</th><th scope="col" className={`${hd} text-right`}>People</th></tr></thead>
          <tbody>
            {RSVPS.map(([k, l]) => <tr key={k} className="border-t border-rule"><th scope="row" className={`${th} font-normal`}>{l}</th><td className={`${num} whitespace-nowrap`}>{gs.records[k]}</td><td className={`${num} whitespace-nowrap`}>{gs.people[k]}</td></tr>)}
            <tr className="border-t-2 border-rule font-semibold"><th scope="row" className={th}>All guests</th><td className={`${num} whitespace-nowrap`}>{gs.totalRecords}</td><td className={`${num} whitespace-nowrap`}>{gs.people.invited + gs.people.confirmed + gs.people.tentative + gs.people.declined}</td></tr>
          </tbody>
        </table></div>
        <p className="num mt-2 text-sm">
          <strong>Attending headcount: {gs.attending}</strong>{gs.capacity !== null ? ` of ${gs.capacity} capacity (${gs.over ? `over by ${-(gs.remaining ?? 0)}` : `${gs.remaining} places left`})` : " (no capacity set)"}. Confirmed plus tentative: {gs.possible}.
        </p>
        {guests.length > 0 && (
          <div className="overflow-x-auto"><table className="mt-3 w-full text-left text-sm">
            <caption className="sr-only">Guest list</caption>
            <thead><tr><th scope="col" className={hd}>Guest or party</th><th scope="col" className={hd}>Group</th><th scope="col" className={`${hd} text-right`}>People</th><th scope="col" className={hd}>RSVP</th></tr></thead>
            <tbody>
              {guests.map((g) => <tr key={g.id} className="border-t border-rule"><th scope="row" className={`${th} font-semibold`}>{g.name}</th><td className={th}>{g.group_name || "None"}</td><td className={`${num} whitespace-nowrap`}>{g.party_size}</td><td className={nw}>{rsvpLabel(g.rsvp)}</td></tr>)}
            </tbody>
          </table></div>
        )}
        {groups.length > 1 && <p className="mt-2 text-xs text-ink-2">Groups: {groups.join(", ")}.</p>}
      </section>

      <section aria-labelledby="s-ros" className="print-section" hidden={!show("ros")}>
        <h2 id="s-ros" className={H2}>Running order</h2>
        <p className="text-xs text-ink-2">Times are in {tz}.</p>
        {entries.length === 0 ? <p className="mt-1 text-sm text-ink-2">No running order recorded.</p> : (
          <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm">
            <thead><tr><th scope="col" className={hd}>Time</th><th scope="col" className={hd}>Activity</th><th scope="col" className={hd}>Responsible</th><th scope="col" className={hd}>Location</th><th scope="col" className={hd}>Checks</th></tr></thead>
            <tbody>
              {entries.map((x, i) => {
                const sd = localDate(new Date(x.starts_at), tz);
                const ed = localDate(new Date(x.ends_at), tz);
                const w = entryChecks.get(x.id) ?? [];
                return (
                  <Fragment key={x.id}>
                    {(i === 0 || sd !== localDate(new Date(entries[i - 1].starts_at), tz)) && <tr className="border-t border-rule bg-primary-tint"><th scope="colgroup" colSpan={5} className={`${th} text-primary`}>{day(x.starts_at)}</th></tr>}
                    <tr className="border-t border-rule align-top">
                      <td className="num whitespace-nowrap px-2 py-1.5">{time(x.starts_at)} to {time(x.ends_at)}{ed !== sd ? " (+1 day)" : ""}<div className="text-xs text-ink-2">{formatDuration(x.starts_at, x.ends_at)}</div></td>
                      <th scope="row" className={`${th} font-semibold`}>{x.title}{x.notes && <div className="text-xs font-normal text-ink-2">{x.notes}</div>}</th>
                      <td className={th}>{nameOf(x.owner_id)}</td>
                      <td className={th}>{x.location || "Not set"}</td>
                      <td className={`${th} text-xs`}>{w.length ? w.map((k) => k.text).join("; ") : "None"}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table></div>
        )}
      </section>

      <section aria-labelledby="s-layout" className="print-section" hidden={!show("layout")}>
        <h2 id="s-layout" className={H2}>Venue layout</h2>
        {!venue ? <p className="mt-1 text-sm text-ink-2">No venue is set.</p> : (
          <>
            <p className="text-sm">{venue.name}, <span className="num">{cmToMetres(venue.width_cm)} m by {cmToMetres(venue.depth_cm)} m</span>. Each grid square is 1 m.</p>
            <div className="mt-2 max-w-3xl">
              <LayoutSvg room={{ w: venue.width_cm, d: venue.depth_cm }} items={layout} label={`Layout of ${venue.name}, ${layout.length} objects`} />
              <LayoutLegend />
            </div>
            {layout.length > 0 && (
              <div className="overflow-x-auto"><table className="mt-3 w-full text-left text-sm">
                <caption className="sr-only">Objects in the layout (metres)</caption>
                <thead><tr><th scope="col" className={hd}>Object</th><th scope="col" className={hd}>Kind</th><th scope="col" className={`${hd} text-right`}>X</th><th scope="col" className={`${hd} text-right`}>Y</th><th scope="col" className={`${hd} text-right`}>Width</th><th scope="col" className={`${hd} text-right`}>Depth</th></tr></thead>
                <tbody>
                  {layout.map((i) => <tr key={i.id} className="border-t border-rule"><th scope="row" className={`${th} font-semibold`}>{i.label || kindLabel(i.kind)}</th><td className={th}>{kindLabel(i.kind)}</td><td className={`${num} whitespace-nowrap`}>{cmToMetres(i.x_cm)}</td><td className={`${num} whitespace-nowrap`}>{cmToMetres(i.y_cm)}</td><td className={`${num} whitespace-nowrap`}>{cmToMetres(i.w_cm)}</td><td className={`${num} whitespace-nowrap`}>{cmToMetres(i.h_cm)}</td></tr>)}
                </tbody>
              </table></div>
            )}
          </>
        )}
      </section>

      <footer className="border-t border-rule pt-3 text-xs text-ink-2" hidden={Boolean(only)}>
        {branding && "Printed from SceneSet. "}Prototype: use fictional information only. Readiness is a planning aid, not a safety, legal or compliance certification.
      </footer>
    </article>
  );
}
