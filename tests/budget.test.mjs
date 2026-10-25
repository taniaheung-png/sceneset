// Budget arithmetic, amount parsing and form validation (phase 4).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { budgetTotals, explainRemaining, explainVariance, percent } from "../src/lib/budget.ts";
import { parseBudgetItemForm, parseQuoteForm } from "../src/lib/budgetForm.ts";
import { parseMajorToMinor, toMajorInput } from "../src/lib/money.ts";

const line = (planned, committed, paid) => ({ planned_minor: planned, committed_minor: committed, paid_minor: paid });
const form = (o) => ({ get: (k) => o[k] ?? null });

describe("budget totals", () => {
  test("sums planned, committed, paid and derives outstanding, remaining, variance", () => {
    const t = budgetTotals([line(100000, 120000, 50000), line(30000, 20000, 20000)], 200000);
    assert.deepEqual(
      { planned: t.planned, committed: t.committed, paid: t.paid, outstanding: t.outstanding, remaining: t.remaining, variance: t.variance },
      { planned: 130000, committed: 140000, paid: 70000, outstanding: 70000, remaining: 60000, variance: 10000 },
    );
    assert.equal(t.over, false);
    assert.equal(explainRemaining(t), "Left to commit");
    assert.equal(explainVariance(t), "Above plan");
  });
  test("empty budget and zero target: zeros, no target, never NaN or 'over budget'", () => {
    const t = budgetTotals([], 0);
    assert.deepEqual([t.planned, t.committed, t.paid, t.outstanding, t.variance], [0, 0, 0, 0, 0]);
    assert.equal(t.remaining, null);
    assert.equal(t.over, false);
    assert.equal(explainRemaining(t), "No budget target set");
    assert.equal(explainVariance(t), "On plan");
    // spending with no target set is not "over budget"
    const u = budgetTotals([line(0, 5000, 0)], 0);
    assert.equal(u.over, false);
    assert.equal(u.remaining, null);
  });
  test("over budget is negative remaining and flagged; exactly on budget is not over", () => {
    const over = budgetTotals([line(0, 100001, 0)], 100000);
    assert.equal(over.remaining, -1);
    assert.equal(over.over, true);
    assert.equal(explainRemaining(over), "Over budget");
    const exact = budgetTotals([line(0, 100000, 0)], 100000);
    assert.equal(exact.remaining, 0);
    assert.equal(exact.over, false);
    assert.equal(explainRemaining(exact), "Exactly on budget");
  });
  test("integer sums are exact where floating point is not (0.10 + 0.20 style)", () => {
    const t = budgetTotals([line(10, 10, 0), line(20, 20, 0)], 0); // 0.10 + 0.20
    assert.equal(t.planned, 30);
    assert.equal(t.committed / 100, 0.3);
    const many = budgetTotals(Array.from({ length: 1000 }, () => line(1, 1, 1)), 0); // 1000 x 0.01
    assert.equal(many.committed, 1000);
  });
  test("variance sign: below plan is negative", () => {
    const t = budgetTotals([line(50000, 40000, 0)], 0);
    assert.equal(t.variance, -10000);
    assert.equal(explainVariance(t), "Below plan");
  });
  test("percent never divides by zero", () => {
    assert.equal(percent(50, 200), 25);
    assert.equal(percent(1, 3), 33);
    assert.equal(percent(5, 0), null);
    assert.equal(percent(NaN, 10), null);
  });
});

describe("amount parsing and display", () => {
  test("rounding cases are exact", () => {
    for (const [input, minor] of [["0.07", 7], ["19.99", 1999], ["1,234.50", 123450], ["0.1", 10], ["1000000.99", 100000099]]) {
      assert.equal(parseMajorToMinor(input), minor, input);
    }
    for (const bad of ["0.005", "1.999", "-0", "1e2", "NaN", "Infinity", "1,2", "1 000", "$5"]) {
      assert.equal(parseMajorToMinor(bad), null, `should reject ${bad}`);
    }
  });
  test("toMajorInput round-trips through parse", () => {
    for (const minor of [0, 7, 100, 123456, 100000099, 1999]) {
      assert.equal(parseMajorToMinor(toMajorInput(minor) || "0"), minor);
    }
    assert.equal(toMajorInput(1999), "19.99");
    assert.equal(toMajorInput(5), "0.05");
  });
});

describe("budget line form", () => {
  const ok = { category: "Decor", name: "Lanterns", planned: "1,000", committed: "1,200.50", paid: "500" };
  test("valid input converts to minor units", () => {
    const r = parseBudgetItemForm(form(ok));
    assert.deepEqual(r.errors, {});
    assert.deepEqual(r.data, { category: "Decor", name: "Lanterns", planned_minor: 100000, committed_minor: 120050, paid_minor: 50000 });
  });
  test("blank amounts are zero (empty line is allowed)", () => {
    const r = parseBudgetItemForm(form({ category: "Other", name: "TBC", planned: "", committed: "", paid: "" }));
    assert.deepEqual(r.data, { category: "Other", name: "TBC", planned_minor: 0, committed_minor: 0, paid_minor: 0 });
  });
  test("negative, too many decimals, unknown category, blank name are reported with typed values kept", () => {
    const r = parseBudgetItemForm(form({ category: "Yachts", name: " ", planned: "-5", committed: "1.234", paid: "x" }));
    assert.deepEqual(Object.keys(r.errors).sort(), ["category", "committed", "name", "paid", "planned"]);
    assert.equal(r.values.planned, "-5");
    assert.equal(r.data, undefined);
  });
  test("paid more than committed is rejected; equal is fine", () => {
    assert.ok(parseBudgetItemForm(form({ ...ok, paid: "1,200.51" })).errors.paid);
    assert.deepEqual(parseBudgetItemForm(form({ ...ok, paid: "1,200.50" })).errors, {});
  });
  test("a quote-linked line ignores any committed value (it comes from the quote)", () => {
    const r = parseBudgetItemForm(form({ ...ok, committed: "999", paid: "10" }), true);
    assert.deepEqual(r.errors, {});
    assert.equal(r.data.committed_minor, 0);
  });
});

describe("quote form", () => {
  const sup = "11111111-2222-3333-4444-555555555555";
  test("valid quote", () => {
    const r = parseQuoteForm(form({ supplier: sup, amount: "2,400", scope: "PA for 6 hours", notes: "" }));
    assert.deepEqual(r.data, { supplier_id: sup, amount_minor: 240000, scope: "PA for 6 hours", notes: "" });
  });
  test("zero is a valid quote amount; blank, negative, forged supplier are not", () => {
    assert.equal(parseQuoteForm(form({ supplier: sup, amount: "0" })).data.amount_minor, 0);
    assert.ok(parseQuoteForm(form({ supplier: sup, amount: "" })).errors.amount);
    assert.ok(parseQuoteForm(form({ supplier: sup, amount: "-1" })).errors.amount);
    assert.ok(parseQuoteForm(form({ supplier: "not-a-uuid", amount: "5" })).errors.supplier);
  });
});
