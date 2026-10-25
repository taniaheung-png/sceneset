import { BUDGET_CATEGORIES, QUOTE_STATUSES } from "./eventOptions.ts";
import { parseMajorToMinor } from "./money.ts";

type Getter = { get(name: string): FormDataEntryValue | null };
export type FormResult<T> = { values: Record<string, string>; errors: Record<string, string>; data?: T };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const read = (fd: Getter, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "").trim()]));
const AMOUNT_HINT = "Enter an amount like 1500 or 1,250.50 (no negatives, at most 2 decimals).";

/** Optional amount field: blank means 0. */
function amount(v: string, errors: Record<string, string>, key: string, label: string): number {
  if (v === "") return 0;
  const m = parseMajorToMinor(v);
  if (m === null) errors[key] = `${label}: ${AMOUNT_HINT}`;
  return m ?? 0;
}

export type BudgetItemInput = { category: string; name: string; planned_minor: number; committed_minor: number; paid_minor: number };

/**
 * Budget line form. `lockCommitted` is used for lines linked to an accepted quote: their committed amount
 * comes from the quote, so any value typed for it is ignored.
 */
export function parseBudgetItemForm(fd: Getter, lockCommitted = false): FormResult<BudgetItemInput> {
  const values = read(fd, ["category", "name", "planned", "committed", "paid"]);
  const errors: Record<string, string> = {};
  if (!(BUDGET_CATEGORIES as readonly string[]).includes(values.category)) errors.category = "Choose a category.";
  if (values.name.length < 1 || values.name.length > 120) errors.name = "Enter a name of 1 to 120 characters.";
  const planned_minor = amount(values.planned, errors, "planned", "Planned");
  const committed_minor = lockCommitted ? 0 : amount(values.committed, errors, "committed", "Committed");
  const paid_minor = amount(values.paid, errors, "paid", "Paid");
  if (!lockCommitted && !errors.committed && !errors.paid && paid_minor > committed_minor) {
    errors.paid = "Paid cannot be more than the committed amount.";
  }
  if (Object.keys(errors).length) return { values, errors };
  return { values, errors, data: { category: values.category, name: values.name, planned_minor, committed_minor, paid_minor } };
}

export type QuoteInput = { supplier_id: string; amount_minor: number; scope: string; notes: string };

/** Quote form. Status is changed by dedicated actions (shortlist/reject/accept), never typed here. */
export function parseQuoteForm(fd: Getter): FormResult<QuoteInput> {
  const values = read(fd, ["supplier", "amount", "scope", "notes"]);
  const errors: Record<string, string> = {};
  if (!UUID.test(values.supplier)) errors.supplier = "Choose a supplier.";
  let amount_minor = 0;
  if (values.amount === "") errors.amount = "Enter the quoted amount.";
  else {
    const m = parseMajorToMinor(values.amount);
    if (m === null) errors.amount = AMOUNT_HINT;
    else amount_minor = m;
  }
  if (values.scope.length > 1000) errors.scope = "Keep the scope under 1000 characters.";
  if (values.notes.length > 2000) errors.notes = "Keep notes under 2000 characters.";
  if (Object.keys(errors).length) return { values, errors };
  return { values, errors, data: { supplier_id: values.supplier, amount_minor, scope: values.scope, notes: values.notes } };
}

export const isQuoteStatus = (s: string) => QUOTE_STATUSES.some(([k]) => k === s);
