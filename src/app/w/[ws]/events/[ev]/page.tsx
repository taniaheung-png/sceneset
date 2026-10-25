import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/site/AuthShell";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { type BudgetLine, budgetTotals, percent } from "@/lib/budget";
import { getEvent, getMembers } from "@/lib/events";
import { guestSummary } from "@/lib/guests";
import { formatMinor } from "@/lib/money";
import { entryWarnings, sortEntries } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { formatInZone, todayIn } from "@/lib/time";
import type { GuestRow, ScheduleRow, TaskRow } from "@/lib/types";

export const metadata: Metadata = { title: "Event dashboard" };

const card = "rounded-lg border border-rule bg-surface p-5";
const MESSAGES: Record<string, string> = { created: "Event created.", saved: "Changes saved." };

export default async function EventDashboard({ params, searchParams }: PageProps<"/w/[ws]/events/[ev]">) {
  const { ws, ev } = await params;
  const sp = await searchParams;
  const { event } = await getEvent(ws, ev);
  const supabase = await createClient();
  const [{ data }, members, bud, quo, gst, sch] = await Promise.all([
    supabase.from("tasks").select("id, title, status, due_on, assignee_id, priority").eq("event_id", ev),
    getMembers(ws),
    supabase.from("budget_items").select("planned_minor, committed_minor, paid_minor").eq("event_id", ev),
    supabase.from("quotes").select("status").eq("event_id", ev),
    supabase.from("guests").select("rsvp, party_size").eq("event_id", ev),
    supabase.from("schedule_entries").select("id, title, starts_at, ends_at, owner_id").eq("event_id", ev),
  ]);
  // Same functions and rows as the Guests and Run of show pages, so the dashboard cannot disagree with them.
  const gs = guestSummary((gst.data ?? []) as Pick<GuestRow, "rsvp" | "party_size">[], event.capacity);
  const entries = sortEntries((sch.data ?? []) as Pick<ScheduleRow, "id" | "title" | "starts_at" | "ends_at" | "owner_id">[]);
  const entryChecks = entryWarnings(entries, event.starts_at, event.ends_at);
  const outsideWindow = [...entryChecks.values()].filter((w) => w.some((x) => x.kind.endsWith("window"))).length;
  const ownerClashes = [...entryChecks.values()].filter((w) => w.some((x) => x.kind === "owner-clash")).length;
  // Same function and same rows as the Budget page, so the dashboard can never disagree with it.
  const totals = budgetTotals((bud.data ?? []) as BudgetLine[], event.budget_target_minor);
  const quoteCount = (s: string) => (quo.data ?? []).filter((x) => x.status === s).length;
  const undecided = quoteCount("requested") + quoteCount("shortlisted");
  const money = (n: number) => formatMinor(n, event.currency);
  const tasks = (data ?? []) as Pick<TaskRow, "id" | "title" | "status" | "due_on" | "assignee_id" | "priority">[];

  // Every number below is derived from saved rows. shortcut: fetches all tasks; switch to count queries beyond ~1,000 tasks.
  const today = todayIn(event.timezone);
  const count = (s: TaskRow["status"]) => tasks.filter((t) => t.status === s).length;
  const overdue = tasks.filter((t) => t.status !== "done" && t.due_on !== null && t.due_on < today);
  const upcoming = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") || a.title.localeCompare(b.title))
    .slice(0, 5);
  const nameOf = (id: string | null) => (id ? members.find((m) => m.user_id === id)?.display_name || "Unnamed" : "Unassigned");
  const flash = typeof sp.m === "string" ? MESSAGES[sp.m] : undefined;
  const base = `/w/${ws}/events/${ev}`;

  return (
    <>
      {flash && <Banner tone="info">{flash}</Banner>}

      {totals.over && totals.remaining !== null && (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-danger-tint p-3 text-sm font-medium text-danger">
          Over budget by {money(-totals.remaining)}.
          <Link href={`${base}/budget`} className="font-semibold underline">Review the budget</Link>
        </p>
      )}

      {overdue.length > 0 && (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-danger-tint p-3 text-sm font-medium text-danger">
          {overdue.length} task{overdue.length === 1 ? " is" : "s are"} overdue.
          <Link href={`${base}/tasks?due=overdue`} className="font-semibold underline">Review overdue tasks</Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="d-tasks" className={card}>
          <h2 id="d-tasks" className="text-lg font-bold">Tasks</h2>
          {tasks.length === 0 ? (
            <>
              <p className="mt-2 text-ink-2">No tasks yet. Add the first one to start planning the work.</p>
              <div className="mt-3"><ButtonLink href={`${base}/tasks`} variant="secondary">Open the task board</ButtonLink></div>
            </>
          ) : (
            <>
              <dl className="num mt-3 grid grid-cols-4 gap-2 text-center">
                {[["To do", count("todo")], ["In progress", count("in_progress")], ["Done", count("done")], ["Overdue", overdue.length]].map(([l, n]) => (
                  <div key={l} className="rounded-md bg-sunken p-2">
                    <dd className="text-2xl font-bold">{n}</dd>
                    <dt className="text-xs text-ink-2">{l}</dt>
                  </div>
                ))}
              </dl>
              <h3 className="mt-4 text-sm font-semibold">Next up</h3>
              <ul className="mt-1 divide-y divide-rule text-sm">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <span>{t.title}<span className="block text-xs text-ink-2">{nameOf(t.assignee_id)}</span></span>
                    <span className="num shrink-0 text-xs">
                      {t.due_on ? (t.due_on < today ? <StatusChip tone="danger">Overdue {t.due_on}</StatusChip> : `Due ${t.due_on}`) : "No due date"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3"><Link href={`${base}/tasks`} className="text-sm font-semibold text-primary underline">Open the task board</Link></div>
            </>
          )}
        </section>

        <section aria-labelledby="d-details" className={card}>
          <h2 id="d-details" className="text-lg font-bold">Event details</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-2">Type</dt><dd>{event.type}</dd>
            <dt className="text-ink-2">Venue</dt><dd>{event.venues?.name ?? "Not set"}</dd>
            <dt className="text-ink-2">Capacity</dt><dd className="num">{event.capacity ?? "Not set"}</dd>
            <dt className="text-ink-2">Budget target</dt><dd className="num">{event.budget_target_minor ? formatMinor(event.budget_target_minor, event.currency) : "Not set"}</dd>
            <dt className="text-ink-2">Goals</dt><dd className="whitespace-pre-line">{event.goals || "Not set"}</dd>
          </dl>
        </section>
      </div>

      <section aria-labelledby="d-budget" className={card}>
        <h2 id="d-budget" className="text-lg font-bold">Budget</h2>
        {!totals.hasTarget && (bud.data ?? []).length === 0 ? (
          <>
            <p className="mt-2 text-ink-2">No budget lines or target yet.</p>
            <div className="mt-3"><ButtonLink href={`${base}/budget`} variant="secondary">Open the budget</ButtonLink></div>
          </>
        ) : (
          <>
            <dl className="num mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
              {[
                ["Target", totals.hasTarget ? money(event.budget_target_minor) : "Not set"],
                ["Committed", money(totals.committed)],
                ["Paid", money(totals.paid)],
                ["Outstanding", money(totals.outstanding)],
                [totals.over ? "Over budget by" : "Remaining", totals.remaining === null ? "Not set" : money(Math.abs(totals.remaining))],
              ].map(([l, v]) => (
                <div key={l}><dt className="text-ink-2">{l}</dt><dd className={`text-lg font-bold ${l === "Over budget by" ? "text-danger" : ""}`}>{v}</dd></div>
              ))}
            </dl>
            {totals.hasTarget && <p className="num mt-2 text-sm text-ink-2">{percent(totals.committed, event.budget_target_minor)}% of the target is committed.</p>}
          </>
        )}
        <p className="mt-3 text-sm">
          {quoteCount("accepted")} quote{quoteCount("accepted") === 1 ? "" : "s"} accepted, {undecided} awaiting a decision.{" "}
          <Link href={`${base}/suppliers`} className="font-semibold text-primary underline">Compare quotes</Link>
          {" · "}
          <Link href={`${base}/budget`} className="font-semibold text-primary underline">Open the budget</Link>
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="d-guests" className={card}>
          <h2 id="d-guests" className="text-lg font-bold">Guests</h2>
          {gs.totalRecords === 0 ? (
            <>
              <p className="mt-2 text-ink-2">No guests yet.</p>
              <div className="mt-3"><ButtonLink href={`${base}/guests`} variant="secondary">Open the guest list</ButtonLink></div>
            </>
          ) : (
            <>
              <p className="num mt-2 text-sm">
                <strong className="text-2xl">{gs.attending}</strong> people attending (confirmed)
                {gs.capacity !== null ? <> of <strong>{gs.capacity}</strong> capacity</> : <span className="text-ink-2">, no capacity set</span>}
              </p>
              {gs.over && gs.remaining !== null && <p role="alert" className="mt-2 text-sm font-semibold text-danger">Over capacity by {-gs.remaining}.</p>}
              {gs.mayExceed && gs.capacity !== null && <p className="mt-2 text-sm font-medium text-warn-ink">Would exceed capacity if every tentative guest comes ({gs.possible} people).</p>}
              <p className="num mt-2 text-sm text-ink-2">
                {gs.totalRecords} guest record{gs.totalRecords === 1 ? "" : "s"}: {gs.records.confirmed} confirmed, {gs.records.tentative} tentative, {gs.records.invited} awaiting a reply, {gs.records.declined} declined.
              </p>
              <div className="mt-3"><Link href={`${base}/guests`} className="text-sm font-semibold text-primary underline">Open the guest list</Link></div>
            </>
          )}
        </section>

        <section aria-labelledby="d-ros" className={card}>
          <h2 id="d-ros" className="text-lg font-bold">Run of show</h2>
          {entries.length === 0 ? (
            <>
              <p className="mt-2 text-ink-2">No running order yet.</p>
              <div className="mt-3"><ButtonLink href={`${base}/schedule`} variant="secondary">Open the running order</ButtonLink></div>
            </>
          ) : (
            <>
              <p className="num mt-2 text-sm"><strong className="text-2xl">{entries.length}</strong> entr{entries.length === 1 ? "y" : "ies"}</p>
              <ul className="mt-2 divide-y divide-rule text-sm">
                {entries.slice(0, 3).map((x) => (
                  <li key={x.id} className="flex justify-between gap-3 py-2">
                    <span>{x.title}</span>
                    <span className="num shrink-0 text-ink-2">{formatInZone(new Date(x.starts_at), event.timezone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span>
                  </li>
                ))}
              </ul>
              {(outsideWindow > 0 || ownerClashes > 0) && (
                <p className="mt-2 text-sm font-medium text-warn-ink">
                  {outsideWindow > 0 && <>{outsideWindow} outside the event window. </>}
                  {ownerClashes > 0 && <>{ownerClashes} with the same person on overlapping entries.</>}
                </p>
              )}
              <div className="mt-3"><Link href={`${base}/schedule`} className="text-sm font-semibold text-primary underline">Open the running order</Link></div>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="d-later" className={`${card} bg-sunken`}>
        <h2 id="d-later" className="text-lg font-bold">Coming in later phases</h2>
        <p className="mt-1 text-sm text-ink-2">
          Venue layout and the readiness check are not built yet, so this dashboard shows no figures for them rather
          than placeholders.
        </p>
      </section>
    </>
  );
}
