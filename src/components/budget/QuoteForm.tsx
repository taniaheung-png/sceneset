"use client";

import { useActionState } from "react";
import { type QuoteFormState, saveQuote } from "@/app/w/[ws]/events/[ev]/suppliers/actions";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** Add or edit a quote for this event. Status is changed with the Shortlist / Reject / Accept actions, not here. */
export function QuoteForm({
  ws,
  ev,
  currency,
  suppliers,
  item,
  version,
  initial = {},
  lockSupplierAndAmount = false,
  submit,
}: {
  ws: string;
  ev: string;
  currency: string;
  suppliers: { id: string; name: string; category: string }[];
  item?: string;
  version?: string;
  initial?: Record<string, string>;
  lockSupplierAndAmount?: boolean;
  submit: string;
}) {
  const [state, action] = useActionState(saveQuote, {} as QuoteFormState);
  // A <select>'s defaultValue is not re-read when React resets the form after a failed submit, so remount the form
  // whenever the server hands back new values/errors; otherwise chosen options would silently revert.
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
        <SelectField name="supplier" label="Supplier" defaultValue={v("supplier")} error={e.supplier} disabled={lockSupplierAndAmount}>
          <option value="">Choose a supplier</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
        </SelectField>
        <TextField name="amount" inputMode="decimal" label={`Quoted amount (${currency})`} defaultValue={v("amount")} error={e.amount} readOnly={lockSupplierAndAmount} hint={lockSupplierAndAmount ? "Accepted quotes are locked. Re-open to change the amount." : undefined} />
      </div>
      {lockSupplierAndAmount && <input type="hidden" name="supplier" value={v("supplier")} />}
      <TextAreaField name="scope" label="Scope" hint="What the price covers." defaultValue={v("scope")} error={e.scope} maxLength={1000} />
      <TextAreaField name="notes" label="Notes" defaultValue={v("notes")} error={e.notes} maxLength={2000} />
      <div><SubmitButton pendingText="Saving…">{submit}</SubmitButton></div>
    </form>
  );
}
