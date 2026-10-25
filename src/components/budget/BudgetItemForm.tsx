"use client";

import { useActionState } from "react";
import { type BudgetFormState, saveBudgetItem } from "@/app/w/[ws]/events/[ev]/budget/actions";
import { SelectField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { BUDGET_CATEGORIES } from "@/lib/eventOptions";

/** Add or edit one budget line. Keeps what you typed when the server rejects it. */
export function BudgetItemForm({
  ws,
  ev,
  currency,
  item,
  version,
  initial = {},
  linked = false,
  submit,
}: {
  ws: string;
  ev: string;
  currency: string;
  item?: string;
  version?: string;
  initial?: Record<string, string>;
  /** True when the line comes from an accepted quote: committed is then set by the quote. */
  linked?: boolean;
  submit: string;
}) {
  const [state, action] = useActionState(saveBudgetItem, {} as BudgetFormState);
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
        <SelectField name="category" label="Category" defaultValue={v("category") || BUDGET_CATEGORIES[0]} error={e.category}>
          {BUDGET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </SelectField>
        <TextField name="name" label="Item" defaultValue={v("name")} error={e.name} maxLength={120} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="planned" inputMode="decimal" label={`Planned (${currency})`} defaultValue={v("planned")} error={e.planned} hint="What you expect to spend." />
        {linked ? (
          <TextField name="committed" label={`Committed (${currency})`} defaultValue={v("committed")} readOnly hint="Set by the accepted quote. Re-open the quote to change it." />
        ) : (
          <TextField name="committed" inputMode="decimal" label={`Committed (${currency})`} defaultValue={v("committed")} error={e.committed} hint="Actual or agreed cost." />
        )}
        <TextField name="paid" inputMode="decimal" label={`Paid (${currency})`} defaultValue={v("paid")} error={e.paid} hint="Already paid. At most the committed amount." />
      </div>
      <div><SubmitButton pendingText="Saving…">{submit}</SubmitButton></div>
    </form>
  );
}
