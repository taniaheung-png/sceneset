"use client";

import { useActionState } from "react";
import { type VenueFormState, saveVenue } from "@/app/w/[ws]/events/[ev]/layout/actions";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** Add or edit a venue. Width and depth are typed in metres. */
export function VenueForm({
  ws,
  ev,
  item,
  version,
  initial = {},
  submit,
}: {
  ws: string;
  ev: string;
  item?: string;
  version?: string;
  initial?: Record<string, string>;
  submit: string;
}) {
  const [state, action] = useActionState(saveVenue, {} as VenueFormState);
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
        <TextField name="name" label="Venue name" defaultValue={v("name")} error={e.name} maxLength={120} required />
        <TextField name="note" label="Address or note" hint="Optional. Fictional details only while this is a prototype." defaultValue={v("note")} error={e.note} maxLength={300} />
        <TextField name="width" inputMode="decimal" label="Width (m)" defaultValue={v("width")} error={e.width} />
        <TextField name="depth" inputMode="decimal" label="Depth (m)" defaultValue={v("depth")} error={e.depth} />
      </div>
      <div><SubmitButton pendingText="Saving…">{submit}</SubmitButton></div>
    </form>
  );
}
