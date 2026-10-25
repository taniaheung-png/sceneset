import type { Metadata } from "next";
import Link from "next/link";
import { BudgetItemForm } from "@/components/budget/BudgetItemForm";
import { Banner } from "@/components/site/AuthShell";
import { ButtonLink } from "@/components/ui/Button";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SelectField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { type BudgetTotals, budgetTotals, explainRemaining, explainVariance, percent } from "@/lib/budget";
import { BUDGET_CATEGORIES } from "@/lib/eventOptions";
import { getEvent } from "@/lib/events";
import { formatMinor, toMajorInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { BudgetRow } from "@/lib/types";
import { deleteBudgetItem } from "./actions";

export const metadata: Metadata = { title: "Budget" };

const MESSAGES: Record<string, [tone: "info" | "danger", text: string]> = {
  "item-added": ["info", "Budget line added."],
  "item-saved": ["info", "Budget line saved."],
  "item-deleted": ["info", "Budget line deleted."],
  forbidden: ["danger", "Your role does not allow that, or it no longer exists. Nothing was changed."],
  invalid: ["danger", "Check the details and try again. Nothing was changed."],
  failed: ["danger", "Something went wrong and nothing was changed. Try again."],
};
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Totals({ t, money, label }: { t: BudgetTotals; money: (n: number) => string; label: string }) {
  const cells: [string, string, string, string?][] = [
    ["Planned", money(t.planned), "What you expect to spend."],
    ["Committed", money(t.committed), "Actual or agreed spending. An accepted quote counts once, on its budget line."],
    ["Paid", money(t.paid), "Already paid out."],
    ["Outstanding", money(t.outstanding), "Committed minus paid: still to pay."],
    ["Remaining", t.remaining === null ? "Not set" : money(t.remaining), `Target minus committed. ${explainRemaining(t)}.`, t.over ? "text-danger" : undefined],
    ["Variance", money(t.variance), `Committed minus planned. Above zero means above plan. ${explainVariance(t)}.`],
  ];
  return (
    <section aria-label={label} className="rounded-lg border border-rule bg-surface p-5">
      <h2 className="text-lg font-bold">{label}</h2>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cells.map(([name, value, help, tone]) => (
          <div key={name}>
            <dt className="text-sm font-semibold">{name}</dt>
            <dd className={`num text-2xl font-bold ${tone ?? ""}`}>{value}</dd>
            <dd className="text-xs text-ink-2">{help}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function Budget({ params, searchParams }: PageProps<"/w/[ws]/events/[ev]/budget">) {
  const { ws, ev } = await params;
  const sp = await searchParams;
  const { event, canManage } = await getEvent(ws, ev);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budget_items")
    .select("id, category, name, planned_minor, committed_minor, paid_minor, quote_id, updated_at")
    .eq("event_id", ev)
    .order("category")
    .order("name");
  const items = (data ?? []) as BudgetRow[];
  const money = (n: number) => formatMinor(n, event.currency);

  const category = (BUDGET_CATEGORIES as readonly string[]).includes(first(sp.category)) ? first(sp.category) : "";
  const shown = category ? items.filter((i) => i.category === category) : items;
  // Overall totals are ALWAYS computed from every line; the category filter only narrows the table and adds a second, labelled panel.
  const overall = budgetTotals(items, event.budget_target_minor);
  const filtered = budgetTotals(shown, 0);
  const usedPct = percent(overall.committed, event.budget_target_minor);
  const msg = MESSAGES[first(sp.m)];
  const base = `/w/${ws}/events/${ev}`;

  return (
    <>
      {msg && <Banner tone={msg[0]}>{msg[1]}</Banner>}
      {error && <Banner tone="danger">We could not load the budget. Refresh to try again.</Banner>}
      {!canManage && <p className="rounded-md bg-sunken p-3 text-sm text-ink-2">You can read the budget. Organisers and owners edit it.</p>}

      {overall.over && overall.remaining !== null && (
        <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm font-semibold text-danger">
          Over budget by {money(-overall.remaining)}: committed {money(overall.committed)} against a target of {money(event.budget_target_minor)}.
        </p>
      )}
      {!overall.hasTarget && (
        <p className="rounded-md bg-warn-tint p-3 text-sm text-warn-ink">
          No budget target is set for this event, so remaining budget cannot be shown. {canManage && <Link href={`${base}/edit`} className="font-semibold underline">Set a target</Link>}
        </p>
      )}

      <Totals t={overall} money={money} label="Totals for all budget lines" />
      {overall.hasTarget && (
        <div className="max-w-xl" aria-label="Budget used">
          <div className="h-3 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${usedPct ?? 0}% of the target is committed`}>
            <div className={`h-full ${overall.over ? "bg-danger" : "bg-primary"}`} style={{ width: `${Math.min(100, usedPct ?? 0)}%` }} />
          </div>
          <p className="num mt-1 text-sm text-ink-2">{usedPct ?? 0}% of the {money(event.budget_target_minor)} target is committed.</p>
        </div>
      )}
      {category && <Totals t={filtered} money={money} label={`Filtered totals: ${category} only`} />}

      <form method="get" role="search" aria-label="Filter budget" className="flex flex-wrap items-end gap-3">
        <SelectField name="category" label="Category" defaultValue={category}>
          <option value="">All categories</option>
          {BUDGET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </SelectField>
        <SubmitButton pendingText="Filtering…">Apply</SubmitButton>
        {category && <Link href={`${base}/budget`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary underline">Clear filter</Link>}
      </form>

      {items.length === 0 ? (
        <section className="max-w-prose rounded-lg border border-rule bg-surface p-6">
          <h2 className="text-lg font-bold">No budget lines yet</h2>
          <p className="mt-2 text-ink-2">Add a line below, or accept a supplier quote to create one automatically.</p>
          <div className="mt-4"><ButtonLink href={`${base}/suppliers`} variant="secondary">Compare supplier quotes</ButtonLink></div>
        </section>
      ) : shown.length === 0 ? (
        <section className="max-w-prose rounded-lg border border-rule bg-surface p-6">
          <h2 className="text-lg font-bold">No lines in {category}</h2>
          <div className="mt-4"><ButtonLink href={`${base}/budget`} variant="secondary">Clear filter</ButtonLink></div>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <caption className="sr-only">Budget lines in {event.currency}</caption>
            <thead className="bg-sunken">
              <tr>
                <th scope="col" className="px-3 py-2">Category</th>
                <th scope="col" className="px-3 py-2">Item</th>
                <th scope="col" className="px-3 py-2 text-right">Planned</th>
                <th scope="col" className="px-3 py-2 text-right">Committed</th>
                <th scope="col" className="px-3 py-2 text-right">Paid</th>
                <th scope="col" className="px-3 py-2 text-right">Outstanding</th>
                <th scope="col" className="px-3 py-2">Source</th>
                <th scope="col" className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.id} className="border-t border-rule align-top" data-line={i.name}>
                  <td className="px-3 py-3">{i.category}</td>
                  <th scope="row" className="px-3 py-3 font-semibold">{i.name}</th>
                  <td className="num px-3 py-3 text-right">{money(i.planned_minor)}</td>
                  <td className="num px-3 py-3 text-right">{money(i.committed_minor)}</td>
                  <td className="num px-3 py-3 text-right">{money(i.paid_minor)}</td>
                  <td className="num px-3 py-3 text-right">{money(i.committed_minor - i.paid_minor)}</td>
                  <td className="px-3 py-3">{i.quote_id ? <StatusChip tone="success">Accepted quote</StatusChip> : <span className="text-ink-2">Entered by hand</span>}</td>
                  <td className="px-3 py-3">
                    {canManage && (
                      <div className="flex flex-col items-start gap-2">
                        <details className="w-full min-w-64 rounded-md border border-rule p-2">
                          <summary className="cursor-pointer text-sm font-semibold">Edit line</summary>
                          <div className="mt-3">
                            <BudgetItemForm
                              ws={ws} ev={ev} currency={event.currency} item={i.id} version={i.updated_at} linked={i.quote_id !== null} submit="Save line"
                              initial={{ category: i.category, name: i.name, planned: toMajorInput(i.planned_minor), committed: toMajorInput(i.committed_minor), paid: toMajorInput(i.paid_minor) }}
                            />
                          </div>
                        </details>
                        <ConfirmAction
                          action={deleteBudgetItem} fields={{ ws, ev, item: i.id }} label="Delete" title="Delete this budget line?"
                          message={i.quote_id ? `"${i.name}" will be deleted and its accepted quote goes back to shortlisted. This cannot be undone.` : `"${i.name}" will be deleted. This cannot be undone.`}
                          confirmLabel="Delete line"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-rule bg-sunken font-semibold">
              <tr>
                <th scope="row" colSpan={2} className="px-3 py-2">{category ? `Total, ${category} only` : "Total, all lines"}</th>
                <td className="num px-3 py-2 text-right">{money(filtered.planned)}</td>
                <td className="num px-3 py-2 text-right">{money(filtered.committed)}</td>
                <td className="num px-3 py-2 text-right">{money(filtered.paid)}</td>
                <td className="num px-3 py-2 text-right">{money(filtered.outstanding)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canManage && (
        <section aria-labelledby="add-h" className="max-w-3xl rounded-lg border border-rule bg-surface p-5">
          <h2 id="add-h" className="text-lg font-bold">Add a budget line</h2>
          <div className="mt-3"><BudgetItemForm ws={ws} ev={ev} currency={event.currency} submit="Add line" /></div>
        </section>
      )}
    </>
  );
}
