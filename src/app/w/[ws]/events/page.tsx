import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Banner } from "@/components/site/AuthShell";
import { ButtonLink } from "@/components/ui/Button";
import { CueTab } from "@/components/ui/CueTab";
import { SelectField, TextField } from "@/components/ui/Field";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { StatusChip } from "@/components/ui/StatusChip";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { EVENT_STATUSES } from "@/lib/eventOptions";
import { createClient } from "@/lib/supabase/server";
import { toLocalInput, formatInZone } from "@/lib/time";
import type { EventRow } from "@/lib/types";
import { getWorkspace } from "@/lib/workspace";
import { loadSampleEvent, setArchived } from "./actions";

export const metadata: Metadata = { title: "Events" };

const MESSAGES: Record<string, [tone: "info" | "danger", text: string]> = {
  archived: ["info", "Event archived. It is hidden from this list; show archived events to restore it."],
  unarchived: ["info", "Event restored."],
  deleted: ["info", "Event deleted."],
  "sample-failed": ["danger", "We could not load the sample event. Nothing was changed. Try again."],
  "plan-limit": ["danger", "The free plan allows 1 active event. Archive another event first, or ask the workspace owner to try a test upgrade under Plan."],
  forbidden: ["danger", "You do not have permission to do that, or the event no longer exists."],
};
const TONE = { planning: "info", confirmed: "success", done: "neutral" } as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function EventsList({ params, searchParams }: PageProps<"/w/[ws]/events">) {
  const { ws } = await params;
  const sp = await searchParams;
  const { workspace, role } = await getWorkspace(ws);
  const canManage = role !== "collaborator";
  const q = first(sp.q).trim().slice(0, 80);
  const status = EVENT_STATUSES.some(([k]) => k === first(sp.status)) ? first(sp.status) : "";
  const archived = first(sp.archived) === "1";
  const msg = MESSAGES[first(sp.m)];

  const supabase = await createClient();
  let query = supabase.from("events").select("*, venues(id, name)").eq("workspace_id", ws).order("starts_at", { ascending: true });
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await query;
  const events = (data ?? []) as EventRow[];
  const filtering = Boolean(q || status || archived);
  // Whether a sample event exists must not depend on the current search or filters.
  const sampleCount = (await supabase.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("demo", true)).count ?? 0;
  const hasSample = sampleCount > 0;

  return (
    <>
      <PageHeader event={workspace.name} title="Events">
        {canManage && hasSample && <ConfirmAction action={loadSampleEvent} fields={{ ws }} label="Reset sample event" title="Reset the sample event?" message="The fictional sample event is deleted and recreated as new, so any changes you made to it are lost. Your own events, suppliers and venues are not touched." confirmLabel="Reset sample event" tone="secondary" />}
        {canManage && <ButtonLink href={`/w/${ws}/events/new`}>New event</ButtonLink>}
      </PageHeader>
      {msg && <Banner tone={msg[0]}>{msg[1]}</Banner>}

      <form method="get" className="flex flex-wrap items-end gap-3" role="search" aria-label="Search events">
        <div className="min-w-48 flex-1"><TextField name="q" type="search" label="Search by title" defaultValue={q} /></div>
        <SelectField name="status" label="Status" defaultValue={status}>
          <option value="">Any status</option>
          {EVENT_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <SelectField name="archived" label="Show" defaultValue={archived ? "1" : ""}>
          <option value="">Active events</option>
          <option value="1">Archived events</option>
        </SelectField>
        <SubmitButton pendingText="Searching…">Search</SubmitButton>
        {filtering && <Link href={`/w/${ws}/events`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary underline">Clear filters</Link>}
      </form>

      {error && <Banner tone="danger">We could not load events. Refresh to try again.</Banner>}

      {!error && events.length === 0 && (
        <section className="max-w-prose rounded-lg border border-rule bg-surface p-6">
          {filtering ? (
            <>
              <h2 className="text-lg font-bold">No events match</h2>
              <p className="mt-2 text-ink-2">Nothing fits those filters. Clear them to see every event.</p>
              <div className="mt-4"><ButtonLink href={`/w/${ws}/events`} variant="secondary">Clear filters</ButtonLink></div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold">No events yet</h2>
              <p className="mt-2 text-ink-2">
                {canManage ? "Create your first event to start planning tasks, suppliers and the running order." : "An organiser or owner needs to create the first event. You will see it here."}
              </p>
              {canManage && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <ButtonLink href={`/w/${ws}/events/new`}>Create your first event</ButtonLink>
                  <form action={loadSampleEvent}>
                    <input type="hidden" name="ws" value={ws} />
                    <SubmitButton variant="secondary" pendingText="Loading…">Load a sample event</SubmitButton>
                  </form>
                </div>
              )}
              {canManage && <p className="mt-2 text-xs text-ink-2">The sample is a fictional market with tasks, quotes, a budget, guests, a running order and a layout. You can reset or delete it any time.</p>}
            </>
          )}
        </section>
      )}

      {events.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">{archived ? "Archived events" : "Events"}</caption>
            <thead className="bg-sunken">
              <tr>
                <th scope="col" className="px-4 py-2">Date</th>
                <th scope="col" className="px-4 py-2">Event</th>
                <th scope="col" className="px-4 py-2">Venue</th>
                <th scope="col" className="px-4 py-2">Status</th>
                <th scope="col" className="px-4 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-rule align-middle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CueTab date={toLocalInput(new Date(e.starts_at), e.timezone).slice(0, 10)} size="sm" />
                      <span className="num text-xs text-ink-2">
                        {formatInZone(new Date(e.starts_at), e.timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                        {" "}{e.timezone.split("/").pop()?.replace("_", " ")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Link href={`/w/${ws}/events/${e.id}`} className="font-semibold text-primary underline">{e.title}</Link>{e.demo && <span className="ml-2"><StatusChip>Sample</StatusChip></span>}</td>
                  <td className="px-4 py-3 text-ink-2">{e.venues?.name ?? "Not set"}</td>
                  <td className="px-4 py-3"><StatusChip tone={TONE[e.status]}>{EVENT_STATUSES.find(([k]) => k === e.status)?.[1]}</StatusChip></td>
                  <td className="px-4 py-3 text-right">
                    {archived && canManage && (
                      <form action={setArchived}>
                        <input type="hidden" name="ws" value={ws} />
                        <input type="hidden" name="ev" value={e.id} />
                        <input type="hidden" name="archive" value="0" />
                        <SubmitButton variant="secondary" pendingText="Restoring…">Restore</SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
