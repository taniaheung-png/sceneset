import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/site/AuthShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CollectionNotice } from "@/components/ui/CollectionNotice";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getEvent, getMembers } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { formatInZone, todayIn } from "@/lib/time";
import type { MemberRow, NoteRow, TaskRow } from "@/lib/types";
import { addNote, createTask, deleteNote, deleteTask, setTaskStatus, updateNote, updateTask } from "./actions";

export const metadata: Metadata = { title: "Tasks and notes" };

const MESSAGES: Record<string, [tone: "info" | "danger", text: string]> = {
  "task-added": ["info", "Task added."],
  "task-saved": ["info", "Task saved."],
  "task-moved": ["info", "Task moved."],
  "task-deleted": ["info", "Task deleted."],
  "note-added": ["info", "Note added."],
  "note-saved": ["info", "Note saved."],
  "note-deleted": ["info", "Note deleted."],
  forbidden: ["danger", "Your role does not allow that, or it no longer exists. Nothing was changed."],
  "bad-link": ["danger", "That person is not a member of this workspace. Nothing was changed."],
  invalid: ["danger", "Check the details (a title is required) and try again. Nothing was changed."],
  failed: ["danger", "Something went wrong and nothing was changed. Try again."],
};
const COLUMNS = [["todo", "To do"], ["in_progress", "In progress"], ["done", "Done"]] as const;
const PRIORITY_TONE = { low: "neutral", medium: "info", high: "warn" } as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Tasks({ params, searchParams }: PageProps<"/w/[ws]/events/[ev]/tasks">) {
  const { ws, ev } = await params;
  const sp = await searchParams;
  const { event, user, canManage } = await getEvent(ws, ev);
  const members = await getMembers(ws);
  const supabase = await createClient();
  const tz = event.timezone;
  const today = todayIn(tz);

  const [{ data: taskData, error }, { data: noteData }] = await Promise.all([
    supabase.from("tasks").select("id, title, description, status, priority, due_on, assignee_id, updated_at").eq("event_id", ev).order("due_on", { ascending: true, nullsFirst: false }).order("created_at"),
    supabase.from("notes").select("id, body, author_id, created_at, updated_at").eq("event_id", ev).order("created_at", { ascending: false }),
  ]);
  const all = (taskData ?? []) as TaskRow[];
  const notes = (noteData ?? []) as NoteRow[];

  const fStatus = COLUMNS.some(([k]) => k === first(sp.status)) ? first(sp.status) : "";
  const fAssignee = first(sp.assignee);
  const fDue = first(sp.due) === "overdue" ? "overdue" : "";
  const filtering = Boolean(fStatus || fAssignee || fDue);
  const shown = all.filter((t) =>
    (!fStatus || t.status === fStatus) &&
    (!fAssignee || (fAssignee === "me" ? t.assignee_id === user.id : fAssignee === "none" ? t.assignee_id === null : t.assignee_id === fAssignee)) &&
    (!fDue || (t.status !== "done" && t.due_on !== null && t.due_on < today)),
  );

  const nameOf = (id: string | null) => (id ? members.find((m: MemberRow) => m.user_id === id)?.display_name || "Unnamed" : "Unassigned");
  const msg = MESSAGES[first(sp.m)];
  const hidden = (extra: Record<string, string> = {}) => (
    <>
      <input type="hidden" name="ws" value={ws} />
      <input type="hidden" name="ev" value={ev} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );
  const memberOptions = members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name || "Unnamed"}</option>);

  return (
    <>
      {msg && <Banner tone={msg[0]}>{msg[1]}</Banner>}
      {error && <Banner tone="danger">We could not load tasks. Refresh to try again.</Banner>}

      {canManage ? (
        <form action={createTask} className="flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-surface p-4" aria-label="Add a task">
          {hidden()}
          <div className="min-w-56 flex-1"><TextField name="title" label="New task" maxLength={200} required /></div>
          <SelectField name="assignee" label="Assign to" defaultValue=""><option value="">Unassigned</option>{memberOptions}</SelectField>
          <TextField name="due" type="date" label="Due" />
          <SelectField name="priority" label="Priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></SelectField>
          <SubmitButton pendingText="Adding…">Add task</SubmitButton>
        </form>
      ) : (
        <p className="rounded-md bg-sunken p-3 text-sm text-ink-2">
          You can move tasks assigned to you between columns. Organisers and owners create and edit tasks.
        </p>
      )}

      <form method="get" role="search" aria-label="Filter tasks" className="flex flex-wrap items-end gap-3">
        <SelectField name="status" label="Status" defaultValue={fStatus}><option value="">Any status</option>{COLUMNS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectField>
        <SelectField name="assignee" label="Assignee" defaultValue={fAssignee}>
          <option value="">Anyone</option><option value="me">Me</option><option value="none">Unassigned</option>{memberOptions}
        </SelectField>
        <SelectField name="due" label="Due" defaultValue={fDue}><option value="">Any date</option><option value="overdue">Overdue</option></SelectField>
        <SubmitButton pendingText="Filtering…">Apply</SubmitButton>
        {filtering && <Link href={`/w/${ws}/events/${ev}/tasks`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary underline">Clear filters</Link>}
      </form>
      {filtering && <p className="text-sm text-ink-2" role="status">Showing {shown.length} of {all.length} tasks.</p>}

      {all.length === 0 ? (
        <section className="max-w-prose rounded-lg border border-rule bg-surface p-6">
          <h2 className="text-lg font-bold">No tasks yet</h2>
          <p className="mt-2 text-ink-2">{canManage ? "Add the first task above, for example “Confirm the stage supplier”." : "An organiser will add tasks here."}</p>
        </section>
      ) : filtering && shown.length === 0 ? (
        <section className="max-w-prose rounded-lg border border-rule bg-surface p-6">
          <h2 className="text-lg font-bold">No tasks match</h2>
          <p className="mt-2 text-ink-2">Nothing fits those filters. Clear them to see the whole board.</p>
          <div className="mt-4"><ButtonLink href={`/w/${ws}/events/${ev}/tasks`} variant="secondary">Clear filters</ButtonLink></div>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map(([key, label]) => {
            const col = shown.filter((t) => t.status === key);
            return (
              <section key={key} aria-labelledby={`col-${key}`} className="rounded-lg bg-sunken p-3">
                <h2 id={`col-${key}`} className="mb-3 flex items-center justify-between text-base font-bold">
                  {label} <span className="num rounded-full bg-surface px-2 text-sm">{col.length}</span>
                </h2>
                <ul className="flex flex-col gap-3">
                  {col.length === 0 && <li className="text-sm text-ink-2">Nothing here.</li>}
                  {col.map((t) => {
                    const overdue = t.status !== "done" && t.due_on !== null && t.due_on < today;
                    const mine = t.assignee_id === user.id;
                    return (
                      <li key={t.id} className="rounded-md border border-rule bg-surface p-3" data-task={t.title}>
                        <h3 className="font-semibold">{t.title}</h3>
                        {t.description && <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{t.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <StatusChip tone={PRIORITY_TONE[t.priority]}>{t.priority[0].toUpperCase() + t.priority.slice(1)} priority</StatusChip>
                          {overdue ? <StatusChip tone="danger">Overdue {t.due_on}</StatusChip> : t.due_on ? <span className="num">Due {t.due_on}</span> : <span className="text-ink-2">No due date</span>}
                          <span>{nameOf(t.assignee_id)}{mine ? " (you)" : ""}</span>
                        </div>
                        {(canManage || mine) && (
                          <form action={setTaskStatus} className="mt-3 flex flex-wrap gap-2" aria-label={`Move ${t.title}`}>
                            {hidden({ item: t.id })}
                            {COLUMNS.filter(([k]) => k !== t.status).map(([k, l]) => (
                              <Button key={k} type="submit" name="status" value={k} variant="secondary" className="min-h-11 px-3">Move to {l}</Button>
                            ))}
                          </form>
                        )}
                        {canManage && (
                          <div className="mt-2 flex flex-wrap items-start gap-2">
                            <details className="w-full rounded-md border border-rule p-2">
                              <summary className="cursor-pointer text-sm font-semibold">Edit task</summary>
                              <form action={updateTask} className="mt-3 flex flex-col gap-3">
                                {hidden({ item: t.id })}
                                <TextField name="title" label="Title" defaultValue={t.title} maxLength={200} required />
                                <TextAreaField name="description" label="Details" defaultValue={t.description} maxLength={2000} />
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <SelectField name="assignee" label="Assign to" defaultValue={t.assignee_id ?? ""}><option value="">Unassigned</option>{memberOptions}</SelectField>
                                  <TextField name="due" type="date" label="Due" defaultValue={t.due_on ?? ""} />
                                  <SelectField name="priority" label="Priority" defaultValue={t.priority}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></SelectField>
                                </div>
                                <SubmitButton pendingText="Saving…">Save task</SubmitButton>
                              </form>
                            </details>
                            <ConfirmAction action={deleteTask} fields={{ ws, ev, item: t.id }} label="Delete" title="Delete this task?" message={`"${t.title}" will be deleted. This cannot be undone.`} confirmLabel="Delete task" />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <section aria-labelledby="notes-h" className="rounded-lg border border-rule bg-surface p-5">
        <h2 id="notes-h" className="text-lg font-bold">Notes</h2>
        <p className="text-sm text-ink-2">Shared with everyone in this workspace.</p>
        <form action={addNote} className="mt-3 flex max-w-2xl flex-col gap-3" aria-label="Add a note">
          {hidden()}
          <TextAreaField name="body" label="New note" maxLength={5000} required />
          <CollectionNotice />
          <div><SubmitButton pendingText="Adding…">Add note</SubmitButton></div>
        </form>
        {notes.length === 0 ? (
          <p className="mt-4 text-ink-2">No notes yet. Use notes for decisions, supplier calls and reminders.</p>
        ) : (
          <ul className="mt-4 divide-y divide-rule">
            {notes.map((n) => {
              const author = n.author_id ? members.find((m) => m.user_id === n.author_id)?.display_name || "Unnamed" : "Former member";
              const own = n.author_id === user.id;
              return (
                <li key={n.id} className="py-3" data-note>
                  <p className="text-xs text-ink-2">
                    <strong>{author}</strong> <span className="num">{formatInZone(new Date(n.created_at), tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line">{n.body}</p>
                  {(own || canManage) && (
                    <div className="mt-2 flex flex-wrap items-start gap-2">
                      <details className="rounded-md border border-rule p-2">
                        <summary className="cursor-pointer text-sm font-semibold">Edit note</summary>
                        <form action={updateNote} className="mt-3 flex flex-col gap-3">
                          {hidden({ item: n.id })}
                          <TextAreaField name="body" label="Note" defaultValue={n.body} maxLength={5000} required />
                          <div><SubmitButton pendingText="Saving…">Save note</SubmitButton></div>
                        </form>
                      </details>
                      <ConfirmAction action={deleteNote} fields={{ ws, ev, item: n.id }} label="Delete" title="Delete this note?" message="The note will be deleted. This cannot be undone." confirmLabel="Delete note" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
