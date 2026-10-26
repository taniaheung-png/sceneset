import type { Metadata } from "next";
import { EventForm } from "@/components/events/EventForm";
import { ButtonLink } from "@/components/ui/Button";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { toLocalInput } from "@/lib/time";
import { deleteEvent, setArchived } from "../../actions";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEvent({ params }: PageProps<"/w/[ws]/events/[ev]/edit">) {
  const { ws, ev } = await params;
  const { event, canManage } = await getEvent(ws, ev);
  if (!canManage) {
    return (
      <section className="max-w-prose panel p-6">
        <h2 className="panel-title">Only organisers and owners can edit events</h2>
        <div className="mt-4"><ButtonLink href={`/w/${ws}/events/${ev}`} variant="secondary">Back to the dashboard</ButtonLink></div>
      </section>
    );
  }
  const supabase = await createClient();
  const { data: venues } = await supabase.from("venues").select("id, name").eq("workspace_id", ws).order("name");
  const major = (minor: number) => (minor === 0 ? "" : minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));
  const tz = event.timezone;

  return (
    <>
      <EventForm
        key={event.updated_at}
        ws={ws}
        ev={ev}
        version={event.updated_at}
        cancelHref={`/w/${ws}/events/${ev}`}
        venues={venues ?? []}
        initial={{
          title: event.title, type: event.type, goals: event.goals, timezone: tz, status: event.status,
          start: toLocalInput(new Date(event.starts_at), tz), end: toLocalInput(new Date(event.ends_at), tz),
          currency: event.currency, capacity: event.capacity === null ? "" : String(event.capacity),
          budget: major(event.budget_target_minor), venue: event.venue_id ?? "",
        }}
      />

      <section aria-labelledby="danger" className="max-w-3xl rounded-lg border border-danger bg-surface p-5">
        <h2 id="danger" className="panel-title">Archive or delete</h2>
        <p className="mt-1 text-sm text-ink-2">
          <strong>Archive</strong> hides the event from the list but keeps everything; you can restore it. <strong>Delete</strong> permanently
          removes the event with its tasks and notes and cannot be undone.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {!event.archived_at ? (
            <ConfirmAction
              action={setArchived}
              fields={{ ws, ev, archive: "1" }}
              label="Archive event"
              title="Archive this event?"
              message="It will be hidden from the events list. Nothing is deleted, and you can restore it later."
              confirmLabel="Archive event"
              tone="secondary"
            />
          ) : (
            <form action={setArchived}>
              <input type="hidden" name="ws" value={ws} />
              <input type="hidden" name="ev" value={ev} />
              <input type="hidden" name="archive" value="0" />
              <SubmitButton variant="secondary" pendingText="Restoring…">Restore event</SubmitButton>
            </form>
          )}
          <ConfirmAction
            action={deleteEvent}
            fields={{ ws, ev }}
            label="Delete event"
            title="Delete this event permanently?"
            message={`"${event.title}" and all of its tasks and notes will be deleted. This cannot be undone.`}
            confirmLabel="Delete permanently"
          />
        </div>
      </section>
    </>
  );
}
