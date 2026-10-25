"use client";

import { useActionState } from "react";
import { type EntryFormState, saveEntry } from "@/app/w/[ws]/events/[ev]/schedule/actions";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** Add or edit one running-order entry. Start and end are wall-clock times in the event's timezone. */
export function EntryForm({
  ws,
  ev,
  timezone,
  members,
  item,
  version,
  initial = {},
  submit,
}: {
  ws: string;
  ev: string;
  timezone: string;
  members: { user_id: string; display_name: string }[];
  item?: string;
  version?: string;
  initial?: Record<string, string>;
  submit: string;
}) {
  const [state, action] = useActionState(saveEntry, {} as EntryFormState);
  // Remount on new server values/errors so the chosen person survives a failed submit (see EventForm).
  const formKey = JSON.stringify([state.values, state.errors, state.error]);
  const v = (k: string) => state.values?.[k] ?? initial[k] ?? "";
  const e = state.errors ?? {};
  return (
    <form key={formKey} action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="ws" value={ws} />
      <input type="hidden" name="ev" value={ev} />
      {item && <input type="hidden" name="item" value={item} />}
      {version && <input type="hidden" name="version" value={version} />}
      {state.error && <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm font-medium text-danger">{state.error}</p>}
      {Object.keys(e).length > 0 && <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm font-medium text-danger">Some details need fixing. Nothing you typed has been lost.</p>}
      <TextField name="title" label="Activity" defaultValue={v("title")} error={e.title} maxLength={200} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="start" type="datetime-local" label="Starts" defaultValue={v("start")} error={e.start} hint={`Time in ${timezone}.`} required />
        <TextField name="end" type="datetime-local" label="Ends" defaultValue={v("end")} error={e.end} hint="May be after midnight: use the next day's date." required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField name="owner" label="Responsible person" defaultValue={v("owner")} error={e.owner}>
          <option value="">Nobody yet</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name || "Unnamed"}</option>)}
        </SelectField>
        <TextField name="location" label="Location" defaultValue={v("location")} error={e.location} maxLength={120} />
      </div>
      <TextAreaField name="notes" label="Notes" defaultValue={v("notes")} error={e.notes} maxLength={2000} />
      <div><SubmitButton pendingText="Saving…">{submit}</SubmitButton></div>
    </form>
  );
}
