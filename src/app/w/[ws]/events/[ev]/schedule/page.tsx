import type { Metadata } from "next";
import { Fragment } from "react";
import { EntryForm } from "@/components/schedule/EntryForm";
import { Banner } from "@/components/site/AuthShell";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { StatusChip } from "@/components/ui/StatusChip";
import { getEvent, getMembers } from "@/lib/events";
import { entryWarnings, sortEntries } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { formatDuration, formatInZone, localDate, toLocalInput } from "@/lib/time";
import type { ScheduleRow } from "@/lib/types";
import { deleteEntry } from "./actions";

export const metadata: Metadata = { title: "Run of show" };

const MESSAGES: Record<string, [tone: "info" | "danger", text: string]> = {
  "entry-added": ["info", "Entry added."],
  "entry-saved": ["info", "Entry saved."],
  "entry-deleted": ["info", "Entry deleted."],
  forbidden: ["danger", "Your role does not allow that, or it no longer exists. Nothing was changed."],
  invalid: ["danger", "Check the details and try again. Nothing was changed."],
  failed: ["danger", "Something went wrong and nothing was changed. Try again."],
};
const WARNING_TONE = { "before-window": "warn", "after-window": "warn", "owner-clash": "danger", parallel: "neutral" } as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Schedule({ params, searchParams }: PageProps<"/w/[ws]/events/[ev]/schedule">) {
  const { ws, ev } = await params;
  const sp = await searchParams;
  const { event, canManage } = await getEvent(ws, ev);
  const members = await getMembers(ws);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_entries")
    .select("id, title, starts_at, ends_at, location, owner_id, notes, updated_at")
    .eq("event_id", ev);
  const entries = sortEntries((data ?? []) as ScheduleRow[]);
  const warnings = entryWarnings(entries, event.starts_at, event.ends_at);

  const tz = event.timezone;
  const time = (iso: string) => formatInZone(new Date(iso), tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const day = (iso: string) => formatInZone(new Date(iso), tz, { weekday: "long", day: "numeric", month: "long" });
  const nameOf = (id: string | null) => (id ? members.find((m) => m.user_id === id)?.display_name || "Unnamed" : null);
  const all = [...warnings.values()].flat();
  const outside = [...warnings.values()].filter((w) => w.some((x) => x.kind.endsWith("window"))).length;
  const clashes = [...warnings.values()].filter((w) => w.some((x) => x.kind === "owner-clash")).length;
  const parallel = [...warnings.values()].filter((w) => w.some((x) => x.kind === "parallel")).length;
  const msg = MESSAGES[first(sp.m)];
  const defaultStart = toLocalInput(new Date(event.starts_at), tz);
  const defaultEnd = toLocalInput(new Date(Date.parse(event.starts_at) + 3600_000), tz);
  const props = { ws, ev, timezone: tz, members };

  return (
    <>
      {msg && <Banner tone={msg[0]}>{msg[1]}</Banner>}
      {error && <Banner tone="danger">We could not load the running order. Refresh to try again.</Banner>}
      {!canManage && <p className="rounded-md bg-sunken p-3 text-sm text-ink-2">You can read the running order. Organisers and owners edit it.</p>}

      <p className="text-sm text-ink-2">
        All times are in <strong>{tz}</strong>. Event window: <span className="num">{formatInZone(new Date(event.starts_at), tz, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span> to{" "}
        <span className="num">{formatInZone(new Date(event.ends_at), tz, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span>.
      </p>

      {entries.length > 0 && (
        <section aria-label="Running order checks" className="panel p-4 text-sm">
          <h2 className="font-bold">Checks</h2>
          {all.length === 0 ? (
            <p className="mt-1 text-ink-2">No overlaps and every entry sits inside the event window.</p>
          ) : (
            <ul className="mt-1 list-disc pl-5">
              {outside > 0 && <li><strong>{outside}</strong> entr{outside === 1 ? "y is" : "ies are"} outside the event window. This is allowed; check it is intended.</li>}
              {clashes > 0 && <li><strong>{clashes}</strong> entr{clashes === 1 ? "y has" : "ies have"} the same person responsible for overlapping activities.</li>}
              {parallel > 0 && <li><strong>{parallel}</strong> entr{parallel === 1 ? "y runs" : "ies run"} in parallel with another. Parallel activities are fine.</li>}
            </ul>
          )}
        </section>
      )}

      {entries.length === 0 ? (
        <section className="max-w-prose panel p-6">
          <h2 className="panel-title">No running order yet</h2>
          <p className="mt-2 text-ink-2">{canManage ? "Add the first activity below, for example “Stallholder load-in”." : "An organiser will add the running order here."}</p>
        </section>
      ) : (
        <div className="overflow-x-auto panel">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Running order in {tz}</caption>
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2">Time</th>
                <th scope="col" className="px-3 py-2">Activity</th>
                <th scope="col" className="px-3 py-2">Responsible</th>
                <th scope="col" className="px-3 py-2">Location</th>
                <th scope="col" className="px-3 py-2">Checks</th>
                <th scope="col" className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((x, i) => {
                const sDay = localDate(new Date(x.starts_at), tz);
                const eDay = localDate(new Date(x.ends_at), tz);
                const newDay = i === 0 || sDay !== localDate(new Date(entries[i - 1].starts_at), tz);
                const w = warnings.get(x.id) ?? [];
                return (
                  <Fragment key={x.id}>
                    {newDay && (
                      <tr className="border-t border-rule bg-primary-tint">
                        <th scope="colgroup" colSpan={6} className="px-3 py-2 text-primary">{day(x.starts_at)}</th>
                      </tr>
                    )}
                    <tr className="border-t border-rule align-top" data-entry={x.title}>
                      <td className="num whitespace-nowrap px-3 py-3">
                        <strong>{time(x.starts_at)}</strong> to {time(x.ends_at)}
                        {eDay !== sDay && <span className="ml-1 text-xs font-semibold text-info">(+1 day)</span>}
                        <div className="text-xs text-ink-2">{formatDuration(x.starts_at, x.ends_at)}</div>
                        {eDay !== sDay && <div className="mt-1"><StatusChip tone="info">Overnight</StatusChip></div>}
                      </td>
                      <th scope="row" className="px-3 py-3 font-semibold">{x.title}{x.notes && <div className="mt-1 text-xs font-normal text-ink-2">{x.notes}</div>}</th>
                      <td className="px-3 py-3">{nameOf(x.owner_id) ?? <span className="text-ink-2">Nobody yet</span>}</td>
                      <td className="px-3 py-3">{x.location || <span className="text-ink-2">Not set</span>}</td>
                      <td className="px-3 py-3">
                        {w.length === 0 ? <span className="text-ink-2">None</span> : (
                          <ul className="flex flex-col items-start gap-1">
                            {w.map((k, j) => <li key={j} className="text-xs"><StatusChip tone={WARNING_TONE[k.kind]}>{k.text}</StatusChip></li>)}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {canManage && (
                          <div className="flex flex-col items-start gap-2">
                            <details className="w-full min-w-72 rounded-md border border-rule p-2">
                              <summary className="cursor-pointer text-sm font-semibold">Edit entry</summary>
                              <div className="mt-3">
                                <EntryForm
                                  {...props} item={x.id} version={x.updated_at} submit="Save entry"
                                  initial={{ title: x.title, start: toLocalInput(new Date(x.starts_at), tz), end: toLocalInput(new Date(x.ends_at), tz), owner: x.owner_id ?? "", location: x.location, notes: x.notes }}
                                />
                              </div>
                            </details>
                            <ConfirmAction action={deleteEntry} fields={{ ws, ev, item: x.id }} label="Delete" title="Delete this entry?" message={`"${x.title}" will be removed from the running order. This cannot be undone.`} confirmLabel="Delete entry" />
                          </div>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <section aria-labelledby="add-entry" className="max-w-3xl panel p-5">
          <h2 id="add-entry" className="panel-title">Add an entry</h2>
          <div className="mt-3"><EntryForm {...props} initial={{ start: defaultStart, end: defaultEnd }} submit="Add entry" /></div>
        </section>
      )}
    </>
  );
}
