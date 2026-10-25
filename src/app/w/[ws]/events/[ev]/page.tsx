import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/site/AuthShell";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { getEvent, getMembers } from "@/lib/events";
import { formatMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/time";
import type { TaskRow } from "@/lib/types";

export const metadata: Metadata = { title: "Event dashboard" };

const card = "rounded-lg border border-rule bg-surface p-5";
const MESSAGES: Record<string, string> = { created: "Event created.", saved: "Changes saved." };

export default async function EventDashboard({ params, searchParams }: PageProps<"/w/[ws]/events/[ev]">) {
  const { ws, ev } = await params;
  const sp = await searchParams;
  const { event } = await getEvent(ws, ev);
  const supabase = await createClient();
  const [{ data }, members] = await Promise.all([
    supabase.from("tasks").select("id, title, status, due_on, assignee_id, priority").eq("event_id", ev),
    getMembers(ws),
  ]);
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

      <section aria-labelledby="d-later" className={`${card} bg-sunken`}>
        <h2 id="d-later" className="text-lg font-bold">Coming in later phases</h2>
        <p className="mt-1 text-sm text-ink-2">
          Budget and suppliers, guests, running order, venue layout and the readiness check are not built yet, so this
          dashboard shows no figures for them rather than placeholders.
        </p>
      </section>
    </>
  );
}
