import type { Metadata } from "next";
import Link from "next/link";
import { QuoteForm } from "@/components/budget/QuoteForm";
import { Banner } from "@/components/site/AuthShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { BUDGET_CATEGORIES } from "@/lib/eventOptions";
import { getEvent } from "@/lib/events";
import { formatMinor, toMajorInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { BudgetRow, QuoteRow, SupplierRow } from "@/lib/types";
import { acceptQuote, addSupplier, deleteQuote, deleteSupplier, reopenQuote, setQuoteStatus, updateSupplier } from "./actions";

export const metadata: Metadata = { title: "Suppliers and quotes" };

const MESSAGES: Record<string, [tone: "info" | "danger", text: string]> = {
  "supplier-added": ["info", "Supplier added."],
  "supplier-saved": ["info", "Supplier saved."],
  "supplier-deleted": ["info", "Supplier deleted."],
  "quote-added": ["info", "Quote added."],
  "quote-saved": ["info", "Quote saved."],
  "quote-moved": ["info", "Quote status updated."],
  "quote-accepted": ["info", "Quote accepted and linked to a budget line. Spending is counted once, on that line."],
  "quote-reopened": ["info", "Quote re-opened. Its budget line was kept but is no longer tied to the quote."],
  "quote-deleted": ["info", "Quote deleted."],
  "supplier-in-use": ["danger", "This supplier has quotes, so it cannot be deleted. Delete or move those quotes first. Nothing was changed."],
  "linked-elsewhere": ["danger", "That quote is already linked to a different budget line. Nothing was changed."],
  "line-unavailable": ["danger", "That budget line is not available (it may already be linked to another quote). Nothing was changed."],
  "paid-too-high": ["danger", "That budget line has already been paid more than this quote. Reduce its paid amount first. Nothing was changed."],
  locked: ["danger", "That quote is accepted. Re-open it before changing its status or amount. Nothing was changed."],
  forbidden: ["danger", "Your role does not allow that, or it no longer exists. Nothing was changed."],
  invalid: ["danger", "Check the details and try again. Nothing was changed."],
  failed: ["danger", "Something went wrong and nothing was changed. Try again."],
};
const STATUS_TONE = { requested: "neutral", shortlisted: "info", accepted: "success", rejected: "danger" } as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const card = "rounded-lg border border-rule bg-surface p-5";

export default async function Suppliers({ params, searchParams }: PageProps<"/w/[ws]/events/[ev]/suppliers">) {
  const { ws, ev } = await params;
  const sp = await searchParams;
  const { event, canManage } = await getEvent(ws, ev);
  const supabase = await createClient();
  const [sup, quo, bud] = await Promise.all([
    supabase.from("suppliers").select("id, name, category, contact_note, notes, updated_at").eq("workspace_id", ws).order("name"),
    supabase.from("quotes").select("id, supplier_id, amount_minor, scope, status, notes, updated_at, suppliers(id, name, category)").eq("event_id", ev).order("amount_minor"),
    supabase.from("budget_items").select("id, name, category, quote_id").eq("event_id", ev).is("quote_id", null).order("name"),
  ]);
  const suppliers = (sup.data ?? []) as SupplierRow[];
  const allQuotes = (quo.data ?? []) as unknown as QuoteRow[];
  const freeLines = (bud.data ?? []) as Pick<BudgetRow, "id" | "name" | "category" | "quote_id">[];

  const q = first(sp.q).trim().slice(0, 80);
  const category = (BUDGET_CATEGORIES as readonly string[]).includes(first(sp.category)) ? first(sp.category) : "";
  const filtering = Boolean(q || category);
  const matchSupplier = (name: string, cat: string) => (!q || name.toLowerCase().includes(q.toLowerCase())) && (!category || cat === category);
  const shownSuppliers = suppliers.filter((s) => matchSupplier(s.name, s.category));
  const shownQuotes = allQuotes.filter((x) => x.suppliers && matchSupplier(x.suppliers.name, x.suppliers.category));
  const msg = MESSAGES[first(sp.m)];
  const base = `/w/${ws}/events/${ev}`;
  const money = (m: number) => formatMinor(m, event.currency);
  const hidden = (extra: Record<string, string> = {}) => (
    <>
      <input type="hidden" name="ws" value={ws} />
      <input type="hidden" name="ev" value={ev} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );
  const supplierFields = (s?: SupplierRow) => (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="name" label="Supplier name" defaultValue={s?.name} maxLength={120} required />
        <SelectField name="category" label="Category" defaultValue={s?.category ?? BUDGET_CATEGORIES[0]}>
          {BUDGET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </SelectField>
      </div>
      <TextField name="contact_note" label="Contact or reference" hint="Fictional details only, e.g. “Ref: SC-104, Ming”." defaultValue={s?.contact_note} maxLength={300} />
      <TextAreaField name="notes" label="Notes" defaultValue={s?.notes} maxLength={2000} />
    </>
  );

  // Group quotes by supplier category, in the standard category order, so like is compared with like.
  const groups = [...BUDGET_CATEGORIES, ...new Set(shownQuotes.map((x) => x.suppliers!.category))]
    .filter((c, i, a) => a.indexOf(c) === i)
    .map((c) => [c, shownQuotes.filter((x) => x.suppliers!.category === c)] as const)
    .filter(([, list]) => list.length > 0);

  return (
    <>
      {msg && <Banner tone={msg[0]}>{msg[1]}</Banner>}
      {!canManage && <p className="rounded-md bg-sunken p-3 text-sm text-ink-2">You can read suppliers and quotes. Organisers and owners add and decide on them.</p>}

      <form method="get" role="search" aria-label="Filter suppliers and quotes" className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1"><TextField name="q" type="search" label="Search suppliers" defaultValue={q} /></div>
        <SelectField name="category" label="Category" defaultValue={category}>
          <option value="">All categories</option>
          {BUDGET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </SelectField>
        <SubmitButton pendingText="Filtering…">Apply</SubmitButton>
        {filtering && <Link href={`${base}/suppliers`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary underline">Clear filters</Link>}
      </form>

      <section aria-labelledby="q-h" className={card}>
        <h2 id="q-h" className="text-lg font-bold">Quote comparison for this event</h2>
        <p className="text-sm text-ink-2">
          Amounts are in {event.currency}. Accepting a quote creates (or fills) one budget line, so spending is counted once.
        </p>

        {allQuotes.length === 0 ? (
          <p className="mt-4 text-ink-2">No quotes yet. {canManage ? "Record a supplier's quote below to start comparing." : "An organiser will add quotes here."}</p>
        ) : groups.length === 0 ? (
          <div className="mt-4">
            <p className="text-ink-2">No quotes match those filters.</p>
            <div className="mt-3"><ButtonLink href={`${base}/suppliers`} variant="secondary">Clear filters</ButtonLink></div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-6">
            {groups.map(([cat, list]) => {
              const live = list.filter((x) => x.status !== "rejected");
              const lowest = live.length > 1 ? Math.min(...live.map((x) => x.amount_minor)) : null;
              return (
                <div key={cat}>
                  <h3 className="font-semibold">{cat} <span className="text-sm font-normal text-ink-2">({list.length} quote{list.length === 1 ? "" : "s"})</span></h3>
                  <div className="mt-2 overflow-x-auto rounded-md border border-rule">
                    <table className="w-full min-w-[44rem] text-left text-sm">
                      <caption className="sr-only">Quotes for {cat}</caption>
                      <thead className="bg-sunken">
                        <tr>
                          <th scope="col" className="px-3 py-2">Supplier</th>
                          <th scope="col" className="px-3 py-2 text-right">Quote</th>
                          <th scope="col" className="px-3 py-2">Scope</th>
                          <th scope="col" className="px-3 py-2">Status</th>
                          <th scope="col" className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((x) => (
                          <tr key={x.id} className="border-t border-rule align-top" data-quote={x.suppliers!.name}>
                            <th scope="row" className="px-3 py-3 font-semibold">{x.suppliers!.name}</th>
                            <td className="num px-3 py-3 text-right">
                              {money(x.amount_minor)}
                              {lowest !== null && x.status !== "rejected" && x.amount_minor === lowest && <div className="text-xs font-semibold text-success">Lowest</div>}
                            </td>
                            <td className="px-3 py-3 text-ink-2">{x.scope || "Not stated"}{x.notes && <div className="mt-1 text-xs">{x.notes}</div>}</td>
                            <td className="px-3 py-3">
                              <StatusChip tone={STATUS_TONE[x.status]}>{x.status[0].toUpperCase() + x.status.slice(1)}</StatusChip>
                              {x.status === "accepted" && <div className="mt-1 text-xs"><Link href={`${base}/budget`} className="font-semibold text-primary underline">See budget line</Link></div>}
                            </td>
                            <td className="px-3 py-3">
                              {canManage ? (
                                <div className="flex flex-col items-start gap-2">
                                  {x.status !== "accepted" && (
                                    <>
                                      <form action={setQuoteStatus} className="flex flex-wrap gap-2" aria-label={`Decide ${x.suppliers!.name}`}>
                                        {hidden({ item: x.id })}
                                        {x.status !== "shortlisted" && <Button type="submit" name="status" value="shortlisted" variant="secondary">Shortlist</Button>}
                                        {x.status !== "rejected" && <Button type="submit" name="status" value="rejected" variant="secondary">Reject</Button>}
                                        {x.status !== "requested" && <Button type="submit" name="status" value="requested" variant="secondary">Back to requested</Button>}
                                      </form>
                                      {x.status !== "rejected" && (
                                        <details className="w-full rounded-md border border-rule p-2">
                                          <summary className="cursor-pointer text-sm font-semibold">Accept…</summary>
                                          <form action={acceptQuote} className="mt-3 flex flex-col gap-3">
                                            {hidden({ item: x.id })}
                                            <SelectField name="into" label="Budget line" defaultValue="" hint="A new line, or fill an existing one. Filling an existing line replaces its committed amount with this quote's amount.">
                                              <option value="">Create a new budget line</option>
                                              {freeLines.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.category})</option>)}
                                            </SelectField>
                                            <div><SubmitButton pendingText="Accepting…">Accept quote</SubmitButton></div>
                                          </form>
                                        </details>
                                      )}
                                    </>
                                  )}
                                  {x.status === "accepted" && (
                                    <ConfirmAction action={reopenQuote} fields={{ ws, ev, item: x.id }} label="Re-open" title="Re-open this quote?" message="The quote goes back to shortlisted. Its budget line is kept (with any payments) but is no longer tied to the quote, so you can edit its committed amount." confirmLabel="Re-open quote" tone="secondary" />
                                  )}
                                  <details className="w-full rounded-md border border-rule p-2">
                                    <summary className="cursor-pointer text-sm font-semibold">Edit quote</summary>
                                    <div className="mt-3">
                                      <QuoteForm
                                        ws={ws} ev={ev} currency={event.currency} suppliers={suppliers} item={x.id} version={x.updated_at}
                                        lockSupplierAndAmount={x.status === "accepted"}
                                        initial={{ supplier: x.supplier_id, amount: toMajorInput(x.amount_minor), scope: x.scope, notes: x.notes }}
                                        submit="Save quote"
                                      />
                                    </div>
                                  </details>
                                  {x.status !== "accepted" && (
                                    <ConfirmAction action={deleteQuote} fields={{ ws, ev, item: x.id }} label="Delete" title="Delete this quote?" message={`The quote from ${x.suppliers!.name} will be deleted. This cannot be undone.`} confirmLabel="Delete quote" />
                                  )}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canManage && (
          <div className="mt-6 max-w-3xl border-t border-rule pt-4">
            <h3 className="font-semibold">Add a quote</h3>
            {suppliers.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">Add a supplier in the directory below first.</p>
            ) : (
              <div className="mt-3"><QuoteForm ws={ws} ev={ev} currency={event.currency} suppliers={suppliers} submit="Add quote" /></div>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="s-h" className={card}>
        <h2 id="s-h" className="text-lg font-bold">Supplier directory</h2>
        <p className="text-sm text-ink-2">Shared by every event in this workspace. Use fictional suppliers while this is a prototype.</p>
        {suppliers.length === 0 ? (
          <p className="mt-4 text-ink-2">No suppliers yet. {canManage ? "Add the first one below." : "An organiser will add suppliers here."}</p>
        ) : shownSuppliers.length === 0 ? (
          <div className="mt-4">
            <p className="text-ink-2">No suppliers match those filters.</p>
            <div className="mt-3"><ButtonLink href={`${base}/suppliers`} variant="secondary">Clear filters</ButtonLink></div>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-rule">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Suppliers</caption>
              <thead className="bg-sunken">
                <tr>
                  <th scope="col" className="px-3 py-2">Supplier</th>
                  <th scope="col" className="px-3 py-2">Category</th>
                  <th scope="col" className="px-3 py-2">Contact or reference</th>
                  <th scope="col" className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shownSuppliers.map((s) => (
                  <tr key={s.id} className="border-t border-rule align-top" data-supplier={s.name}>
                    <th scope="row" className="px-3 py-3 font-semibold">{s.name}{s.notes && <div className="mt-1 text-xs font-normal text-ink-2">{s.notes}</div>}</th>
                    <td className="px-3 py-3">{s.category}</td>
                    <td className="px-3 py-3 text-ink-2">{s.contact_note || "None"}</td>
                    <td className="px-3 py-3">
                      {canManage && (
                        <div className="flex flex-col items-start gap-2">
                          <details className="w-full rounded-md border border-rule p-2">
                            <summary className="cursor-pointer text-sm font-semibold">Edit supplier</summary>
                            <form action={updateSupplier} className="mt-3 flex flex-col gap-3">
                              {hidden({ item: s.id })}
                              {supplierFields(s)}
                              <div><SubmitButton pendingText="Saving…">Save supplier</SubmitButton></div>
                            </form>
                          </details>
                          <ConfirmAction action={deleteSupplier} fields={{ ws, ev, item: s.id }} label="Delete" title="Delete this supplier?" message={`${s.name} will be deleted. A supplier that still has quotes cannot be deleted.`} confirmLabel="Delete supplier" />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canManage && (
          <form action={addSupplier} className="mt-6 flex max-w-3xl flex-col gap-3 border-t border-rule pt-4" aria-label="Add a supplier">
            <h3 className="font-semibold">Add a supplier</h3>
            {hidden()}
            {supplierFields()}
            <div><SubmitButton pendingText="Adding…">Add supplier</SubmitButton></div>
          </form>
        )}
      </section>
    </>
  );
}
