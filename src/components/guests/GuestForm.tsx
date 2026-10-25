"use client";

import { useActionState } from "react";
import { type GuestFormState, saveGuest } from "@/app/w/[ws]/events/[ev]/guests/actions";
import { CollectionNotice } from "@/components/ui/CollectionNotice";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { RSVPS } from "@/lib/guests";

/** Add or edit one guest record. A record can stand for a party (party size = number of people). */
export function GuestForm({
  ws,
  ev,
  item,
  version,
  initial = {},
  submit,
  notice = true,
}: {
  ws: string;
  ev: string;
  item?: string;
  version?: string;
  initial?: Record<string, string>;
  submit: string;
  notice?: boolean;
}) {
  const [state, action] = useActionState(saveGuest, {} as GuestFormState);
  // Remount on new server values/errors so chosen <select> options survive a failed submit (see EventForm).
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
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="name" label="Guest or party name" defaultValue={v("name")} error={e.name} maxLength={120} required />
        <TextField name="contact" label="Contact detail" hint="Optional. Fictional details only while this is a prototype." defaultValue={v("contact")} error={e.contact} maxLength={200} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="group" label="Group" hint="e.g. Vendors, Friends, Press" defaultValue={v("group")} error={e.group} maxLength={60} />
        <TextField name="party" inputMode="numeric" label="People in this party" hint="1 for one person." defaultValue={v("party") || "1"} error={e.party} />
        <SelectField name="rsvp" label="RSVP status" defaultValue={v("rsvp") || "invited"} error={e.rsvp}>
          {RSVPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
      </div>
      <TextAreaField name="notes" label="Notes" defaultValue={v("notes")} error={e.notes} maxLength={1000} />
      {notice && <CollectionNotice>Guest names and contact details are visible to everyone in this workspace.</CollectionNotice>}
      <div><SubmitButton pendingText="Saving…">{submit}</SubmitButton></div>
    </form>
  );
}
