import Link from "next/link";
import { Banner } from "@/components/site/AuthShell";
import { ButtonLink } from "@/components/ui/Button";
import { CheckCircleIcon, ClockIcon, UsersIcon, WalletIcon } from "@/components/ui/icons";
import { StatusChip } from "@/components/ui/StatusChip";
import { percent } from "@/lib/budget";
import { formatMinor } from "@/lib/money";
import type { Plan } from "@/lib/plan";
import { formatInZone } from "@/lib/time";
import { ReadinessPanel } from "./ReadinessPanel";

const textLink = "shrink-0 whitespace-nowrap text-[0.8125rem] font-semibold text-primary underline-offset-2 hover:underline";

/** A thin progress bar. `tone` picks the fill; the number beside it always says the same thing in words. */
function Bar({ value, tone = "coral", onNavy = false }: { value: number; tone?: "coral" | "sage"; onNavy?: boolean }) {
  return (
    <div aria-hidden className={`h-[0.3125rem] overflow-hidden rounded-full ${onNavy ? "bg-white/20" : "bg-sunken"}`}>
      <div className={`h-full rounded-full ${tone === "sage" ? "bg-sage" : "bg-coral"}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/**
 * The event dashboard. Used by the signed-in app (rows from the database) and by the public read-only demo (a fixed
 * fictional dataset), through the same Plan object, so both show identical rules and arithmetic.
 */
export function DashboardView({ plan: p, base, flash, readOnly = false }: { plan: Plan; base: string; flash?: string; readOnly?: boolean }) {
  const { event, tasks, totals, gs, entries, today, overdue, outsideWindow, ownerClashes, members, venue, layout, ready } = p;
  const money = (n: number) => formatMinor(n, event.currency);
  const count = (s: "todo" | "in_progress" | "done") => tasks.filter((t) => t.status === s).length;
  const open = tasks.filter((t) => t.status !== "done").length;
  const upcoming = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") || a.title.localeCompare(b.title))
    .slice(0, 5);
  const nameOf = (id: string | null) => (id ? members.find((m) => m.user_id === id)?.display_name || "Unnamed" : "Unassigned");
  const quoteCount = (s: string) => p.quotes.filter((x) => x.status === s).length;
  const used = totals.hasTarget ? percent(totals.committed, event.budget_target_minor) : null;

  return (
    <>
      {flash && <Banner tone="info">{flash}</Banner>}

      {totals.over && totals.remaining !== null && (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-[0.5625rem] bg-danger-tint px-4 py-3 text-sm font-medium text-danger">
          Over budget by {money(-totals.remaining)}.
          <Link href={`${base}/budget`} className="font-semibold underline">Review the budget</Link>
        </p>
      )}
      {overdue.length > 0 && (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-[0.5625rem] bg-danger-tint px-4 py-3 text-sm font-medium text-danger">
          {overdue.length} task{overdue.length === 1 ? " is" : "s are"} overdue.
          <Link href={`${base}/tasks?due=overdue`} className="font-semibold underline">Review overdue tasks</Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-[0.8125rem] min-[1121px]:grid-cols-4" aria-label="Event at a glance" role="group">
        <div className="metric">
          <div className="flex items-center justify-between gap-2"><span className="metric-label">Readiness</span><span className="tile tile-sage"><CheckCircleIcon width={15} height={15} /></span></div>
          <p className="metric-value num">{ready.percent}%</p>
          <p className="metric-foot num">{ready.passed} of {ready.total} checks passed</p>
        </div>
        <div className="metric">
          <div className="flex items-center justify-between gap-2"><span className="metric-label">Open tasks</span><span className="tile"><ClockIcon width={15} height={15} /></span></div>
          <p className="metric-value num">{open}</p>
          <p className={`metric-foot ${overdue.length > 0 ? "font-bold !text-coral-dark" : ""}`}>{overdue.length > 0 ? `${overdue.length} overdue` : tasks.length === 0 ? "No tasks yet" : "None overdue"}</p>
        </div>
        <div className="metric">
          <div className="flex items-center justify-between gap-2"><span className="metric-label">Budget committed</span><span className="tile tile-coral"><WalletIcon width={15} height={15} /></span></div>
          <p className="metric-value num">{money(totals.committed)}</p>
          <p className="metric-foot num">{totals.hasTarget ? `of ${money(event.budget_target_minor)} target` : "No target set"}</p>
        </div>
        <div className="metric">
          <div className="flex items-center justify-between gap-2"><span className="metric-label">Guests attending</span><span className="tile tile-gold"><UsersIcon width={15} height={15} /></span></div>
          <p className="metric-value num">{gs.attending}</p>
          <p className="metric-foot num">{gs.capacity !== null ? `of ${gs.capacity} capacity` : "No capacity set"}</p>
        </div>
      </div>

      <div className="grid items-start gap-[0.9375rem] min-[1121px]:grid-cols-[minmax(0,1.65fr)_minmax(16.25rem,0.95fr)]">
        <div className="flex min-w-0 flex-col gap-[0.9375rem]">
          <section aria-labelledby="d-tasks" className="panel min-w-0">
            <div className="panel-head">
              <div>
                <h2 id="d-tasks" className="panel-title">Tasks</h2>
                <p className="panel-cap">{open} open · {overdue.length} overdue</p>
              </div>
              <Link href={`${base}/tasks`} className={textLink}>Open the task board</Link>
            </div>
            <div className="panel-body">
              {tasks.length === 0 ? (
                <>
                  <p className="text-sm text-ink-2">No tasks yet. Add the first one to start planning the work.</p>
                  <div className="mt-3"><ButtonLink href={`${base}/tasks`} variant="secondary">Open the task board</ButtonLink></div>
                </>
              ) : (
                <>
                  <dl className="num grid grid-cols-4 gap-2 text-center">
                    {[["To do", count("todo")], ["In progress", count("in_progress")], ["Done", count("done")], ["Overdue", overdue.length]].map(([l, n]) => (
                      <div key={l} className={`rounded-lg px-1 py-2 ${l === "Overdue" && Number(n) > 0 ? "bg-coral-soft" : "bg-paper"}`}>
                        <dd className={`text-xl font-bold ${l === "Overdue" && Number(n) > 0 ? "text-coral-dark" : "text-navy"}`}>{n}</dd>
                        <dt className="text-xs text-ink-2">{l}</dt>
                      </div>
                    ))}
                  </dl>
                  <h3 className="mb-1 mt-4 text-[0.8125rem] font-bold text-navy">Next up</h3>
                  <ul className="divide-y divide-rule text-sm">
                    {upcoming.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block font-medium text-ink">{t.title}</span>
                          <span className="block text-xs text-ink-2">{nameOf(t.assignee_id)}</span>
                        </span>
                        <span className="num shrink-0 text-xs">
                          {t.due_on ? (t.due_on < today ? <StatusChip tone="danger">Overdue {t.due_on}</StatusChip> : <span className="text-ink-2">Due {t.due_on}</span>) : <span className="text-ink-2">No due date</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>

          <ReadinessPanel r={ready} base={base} links={!readOnly} />
        </div>

        <div className="flex min-w-0 flex-col gap-[0.9375rem]">
          <section aria-labelledby="d-budget" className="panel min-w-0">
            <div className="panel-head">
              <div>
                <h2 id="d-budget" className="panel-title">Budget</h2>
                <p className="panel-cap">Where the money stands.</p>
              </div>
            </div>
            <div className="panel-body">
              {!totals.hasTarget && p.budget.length === 0 ? (
                <>
                  <p className="text-sm text-ink-2">No budget lines or target yet.</p>
                  <div className="mt-3"><ButtonLink href={`${base}/budget`} variant="secondary">Open the budget</ButtonLink></div>
                </>
              ) : (
                <div className="navy-card px-[1.0625rem] pb-[1.0625rem] pt-[0.9375rem]">
                  <dl className="num grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
                    {[
                      ["Target", totals.hasTarget ? money(event.budget_target_minor) : "Not set"],
                      ["Committed", money(totals.committed)],
                      ["Paid", money(totals.paid)],
                      ["Outstanding", money(totals.outstanding)],
                      [totals.over ? "Over budget by" : "Remaining", totals.remaining === null ? "Not set" : money(Math.abs(totals.remaining))],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <dt className="text-xs text-white/75">{l}</dt>
                        <dd className={`text-lg font-bold tracking-tight ${l === "Over budget by" ? "text-coral-soft" : "text-surface"}`}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {used !== null && (
                    <div className="mt-4">
                      <Bar value={used} onNavy />
                      <p className="num mt-2 text-xs text-white/80">{used}% of the target is committed.</p>
                    </div>
                  )}
                </div>
              )}
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-2">
                {quoteCount("accepted")} quote{quoteCount("accepted") === 1 ? "" : "s"} accepted, {p.undecided} awaiting a decision.{" "}
                <Link href={`${base}/suppliers`} className={textLink}>Compare quotes</Link>
                {" · "}
                <Link href={`${base}/budget`} className={textLink}>Open the budget</Link>
              </p>
            </div>
          </section>

          <section aria-labelledby="d-ros" className="panel min-w-0">
            <div className="panel-head">
              <div>
                <h2 id="d-ros" className="panel-title">Run of show</h2>
                <p className="panel-cap">First entries, in event time.</p>
              </div>
              <Link href={`${base}/schedule`} className={textLink}>Open the running order</Link>
            </div>
            <div className="panel-body">
              {entries.length === 0 ? (
                <>
                  <p className="text-sm text-ink-2">No running order yet.</p>
                  <div className="mt-3"><ButtonLink href={`${base}/schedule`} variant="secondary">Open the running order</ButtonLink></div>
                </>
              ) : (
                <>
                  <p className="num text-sm text-ink-2"><strong className="text-xl text-navy">{entries.length}</strong> entr{entries.length === 1 ? "y" : "ies"}</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {entries.slice(0, 3).map((x) => (
                      <li key={x.id} className="row-card flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
                        <span className="font-semibold text-navy">{x.title}</span>
                        <span className="num shrink-0 text-xs text-ink-2">{formatInZone(new Date(x.starts_at), event.timezone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span>
                      </li>
                    ))}
                  </ul>
                  {(outsideWindow > 0 || ownerClashes > 0) && (
                    <p className="mt-3 rounded-lg bg-warn-tint px-3 py-2 text-[0.8125rem] font-medium text-warn-ink">
                      {outsideWindow > 0 && <>{outsideWindow} outside the event window. </>}
                      {ownerClashes > 0 && <>{ownerClashes} with the same person on overlapping entries.</>}
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          <section aria-labelledby="d-guests" className="panel min-w-0">
            <div className="panel-head">
              <div>
                <h2 id="d-guests" className="panel-title">Guests</h2>
                <p className="panel-cap">Confirmed people against capacity.</p>
              </div>
            </div>
            <div className="panel-body">
              {gs.totalRecords === 0 ? (
                <>
                  <p className="text-sm text-ink-2">No guests yet.</p>
                  <div className="mt-3"><ButtonLink href={`${base}/guests`} variant="secondary">Open the guest list</ButtonLink></div>
                </>
              ) : (
                <>
                  <p className="num text-sm">
                    <strong className="text-2xl text-navy">{gs.attending}</strong> people attending (confirmed)
                    {gs.capacity !== null ? <> of <strong>{gs.capacity}</strong> capacity</> : <span className="text-ink-2">, no capacity set</span>}
                  </p>
                  {gs.capacity ? <div className="mt-2"><Bar value={percent(gs.attending, gs.capacity) ?? 0} tone={gs.over ? "coral" : "sage"} /></div> : null}
                  {gs.over && gs.remaining !== null && <p role="alert" className="mt-2 text-sm font-semibold text-danger">Over capacity by {-gs.remaining}.</p>}
                  {gs.mayExceed && gs.capacity !== null && <p className="mt-2 text-[0.8125rem] font-medium text-warn-ink">Would exceed capacity if every tentative guest comes ({gs.possible} people).</p>}
                  <p className="num mt-2 text-[0.8125rem] text-ink-2">
                    {gs.totalRecords} guest record{gs.totalRecords === 1 ? "" : "s"}: {gs.records.confirmed} confirmed, {gs.records.tentative} tentative, {gs.records.invited} awaiting a reply, {gs.records.declined} declined.
                  </p>
                  <div className="mt-3"><Link href={`${base}/guests`} className={textLink}>Open the guest list</Link></div>
                </>
              )}
            </div>
          </section>

          <section aria-labelledby="d-layout" className="panel min-w-0">
            <div className="panel-head">
              <div>
                <h2 id="d-layout" className="panel-title">Venue layout</h2>
                <p className="panel-cap">Tables, stage and entrances on the floor plan.</p>
              </div>
            </div>
            <div className="panel-body">
              {!venue ? (
                <>
                  <p className="text-sm text-ink-2">No venue is set, so there is no layout yet.</p>
                  <div className="mt-3"><ButtonLink href={`${base}/layout`} variant="secondary">Choose a venue</ButtonLink></div>
                </>
              ) : (
                <>
                  <p className="num text-sm text-ink-2">
                    <strong className="text-2xl text-navy">{layout.length}</strong> object{layout.length === 1 ? "" : "s"} placed in {venue.name} ({(venue.width_cm / 100).toFixed(1)} m by {(venue.depth_cm / 100).toFixed(1)} m)
                  </p>
                  <div className="mt-3"><Link href={`${base}/layout`} className={textLink}>{layout.length ? "Open the layout" : "Start the layout"}</Link></div>
                </>
              )}
            </div>
          </section>

          <section aria-labelledby="d-details" className="panel min-w-0">
            <div className="panel-head"><h2 id="d-details" className="panel-title">Event details</h2></div>
            <div className="panel-body">
              <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
                <dt className="text-ink-2">Type</dt><dd>{event.type}</dd>
                <dt className="text-ink-2">Venue</dt><dd>{event.venues?.name ?? "Not set"}</dd>
                <dt className="text-ink-2">Capacity</dt><dd className="num">{event.capacity ?? "Not set"}</dd>
                <dt className="text-ink-2">Budget target</dt><dd className="num">{event.budget_target_minor ? money(event.budget_target_minor) : "Not set"}</dd>
                <dt className="text-ink-2">Goals</dt><dd className="whitespace-pre-line">{event.goals || "Not set"}</dd>
              </dl>
            </div>
          </section>
        </div>
      </div>

      <p className="text-sm">
        <Link href={`${base}/summary`} className="font-semibold text-primary underline">Open the printable event summary</Link>
      </p>
    </>
  );
}
