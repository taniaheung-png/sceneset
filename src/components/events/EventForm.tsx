"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type EventFormState, saveEvent } from "@/app/w/[ws]/events/actions";
import { CollectionNotice } from "@/components/ui/CollectionNotice";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CURRENCIES, EVENT_STATUSES, EVENT_TYPES, TIMEZONES } from "@/lib/eventOptions";

export type EventFormInitial = Record<string, string>;

export function EventForm({
  ws,
  ev,
  version,
  initial,
  venues,
  cancelHref,
}: {
  ws: string;
  ev?: string;
  version?: string;
  initial: EventFormInitial;
  venues: { id: string; name: string }[];
  cancelHref: string;
}) {
  const [state, action] = useActionState(saveEvent, {} as EventFormState);
  // A <select>'s defaultValue is not re-read when React resets the form after a failed submit, so remount the form
  // whenever the server hands back new values/errors; otherwise chosen options would silently revert.
  const formKey = JSON.stringify([state.values, state.errors, state.error]);
  const v = (k: string) => state.values?.[k] ?? initial[k] ?? "";
  const e = state.errors ?? {};

  return (
    <form key={formKey} action={action} className="flex max-w-3xl flex-col gap-5" noValidate>
      <input type="hidden" name="ws" value={ws} />
      {ev && <input type="hidden" name="ev" value={ev} />}
      {version && <input type="hidden" name="version" value={version} />}
      {state.error && (
        <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm font-medium text-danger">{state.error}</p>
      )}
      {Object.keys(e).length > 0 && (
        <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm font-medium text-danger">
          Some details need fixing. The fields below explain what to change; nothing you typed has been lost.
        </p>
      )}

      <TextField name="title" label="Event title" defaultValue={v("title")} error={e.title} maxLength={120} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="type" label="Type" defaultValue={v("type") || EVENT_TYPES[0]} error={e.type}>
          {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </SelectField>
        <SelectField name="status" label="Planning status" defaultValue={v("status") || "planning"} error={e.status}>
          {EVENT_STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </SelectField>
      </div>
      <TextAreaField name="goals" label="Goals" hint="What should this event achieve?" defaultValue={v("goals")} error={e.goals} maxLength={2000} />

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold">When</legend>
        <SelectField name="timezone" label="Timezone" defaultValue={v("timezone") || "Asia/Hong_Kong"} error={e.timezone} hint="Times below are in this zone.">
          {TIMEZONES.map((z) => <option key={z}>{z}</option>)}
        </SelectField>
        <TextField name="start" type="datetime-local" label="Starts" defaultValue={v("start")} error={e.start} required />
        <TextField name="end" type="datetime-local" label="Ends" defaultValue={v("end")} error={e.end} required hint="May be after midnight." />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold">Size and budget</legend>
        <TextField name="capacity" inputMode="numeric" label="Capacity" defaultValue={v("capacity")} error={e.capacity} hint="Optional. People allowed." />
        <SelectField name="currency" label="Currency" defaultValue={v("currency") || "HKD"} error={e.currency}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </SelectField>
        <TextField name="budget" inputMode="decimal" label="Budget target" defaultValue={v("budget")} error={e.budget} hint="Optional. e.g. 80,000" />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Venue</legend>
        <SelectField name="venue" label="Choose a venue" defaultValue={v("venue")} error={e.venue}>
          <option value="">No venue yet</option>
          {venues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </SelectField>
        <details className="rounded-md border border-rule p-3" open={Boolean(v("venueName"))}>
          <summary className="cursor-pointer text-sm font-semibold">Or add a new venue</summary>
          <p className="mt-2 text-xs text-ink-2">If you fill this in, it is used instead of the venue chosen above. Sizes are in metres.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <TextField name="venueName" label="Venue name" defaultValue={v("venueName")} error={e.venueName} maxLength={120} />
            <TextField name="venueWidth" inputMode="decimal" label="Width (m)" defaultValue={v("venueWidth")} error={e.venueWidth} />
            <TextField name="venueDepth" inputMode="decimal" label="Depth (m)" defaultValue={v("venueDepth")} />
          </div>
        </details>
      </fieldset>

      <CollectionNotice>Event details are visible to everyone in this workspace.</CollectionNotice>
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingText="Saving…">{ev ? "Save changes" : "Create event"}</SubmitButton>
        <Link href={cancelHref} className="inline-flex min-h-11 items-center rounded-md border border-control bg-surface px-4 text-sm font-semibold hover:bg-sunken">
          Cancel
        </Link>
      </div>
    </form>
  );
}
