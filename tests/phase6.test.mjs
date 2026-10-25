// Layout geometry and readiness (phase 6).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { KINDS, boxProblem, clampBox, cmToMetres, fits, metresToCm, moveBy, newBox, resizeBy } from "../src/lib/layout.ts";
import { readiness } from "../src/lib/readiness.ts";

const room = { w: 1000, d: 800 };

describe("layout bounds", () => {
  test("fits: exactly flush is fine; one centimetre over, negative or tiny is not", () => {
    assert.equal(fits({ x: 900, y: 700, w: 100, h: 100 }, room), true);
    assert.equal(fits({ x: 901, y: 700, w: 100, h: 100 }, room), false);
    assert.equal(fits({ x: 900, y: 701, w: 100, h: 100 }, room), false);
    assert.equal(fits({ x: -1, y: 0, w: 100, h: 100 }, room), false);
    assert.equal(fits({ x: 0, y: 0, w: 9, h: 100 }, room), false);
  });
  test("moveBy stops at every edge and never leaves the venue", () => {
    const b = { x: 50, y: 50, w: 100, h: 100 };
    assert.deepEqual(moveBy(b, -500, -500, room), { x: 0, y: 0, w: 100, h: 100 });
    assert.deepEqual(moveBy(b, 5000, 5000, room), { x: 900, y: 700, w: 100, h: 100 });
    assert.deepEqual(moveBy(b, 10, -10, room), { x: 60, y: 40, w: 100, h: 100 });
  });
  test("resizeBy keeps the corner fixed, stops at the venue edge and at the minimum size", () => {
    const b = { x: 800, y: 600, w: 100, h: 100 };
    assert.deepEqual(resizeBy(b, 500, 500, room), { x: 800, y: 600, w: 200, h: 200 }); // grows to the edge only
    assert.deepEqual(resizeBy(b, -500, -500, room), { x: 800, y: 600, w: 10, h: 10 });
  });
  test("clampBox: an oversize box shrinks to the room; the result always fits", () => {
    const c = clampBox({ x: 5000, y: -50, w: 5000, h: 5, }, room);
    assert.deepEqual(c, { x: 0, y: 0, w: 1000, h: 10 });
    for (const b of [{ x: 1, y: 1, w: 1, h: 1 }, { x: 999, y: 799, w: 400, h: 400 }, { x: -9, y: 9.6, w: 33.4, h: 99.5 }]) assert.equal(fits(clampBox(b, room), room), true);
  });
  test("boxProblem explains what is wrong in plain words", () => {
    assert.equal(boxProblem({ x: 0, y: 0, w: 100, h: 100 }, room), null);
    assert.match(boxProblem({ x: 950, y: 0, w: 100, h: 100 }, room), /10\.50 m across; the venue is 10\.00 m wide/);
    assert.match(boxProblem({ x: 0, y: 750, w: 100, h: 100 }, room), /deep/);
    assert.match(boxProblem({ x: -1, y: 0, w: 100, h: 100 }, room), /negative/);
    assert.match(boxProblem({ x: 0, y: 0, w: 5, h: 100 }, room), /at least 0\.1 m/);
    assert.match(boxProblem({ x: NaN, y: 0, w: 100, h: 100 }, room), /numbers/);
  });
  test("metres to centimetres is exact, rejects negatives and long decimals; round trip", () => {
    assert.equal(metresToCm("1.25"), 125);
    assert.equal(metresToCm("3"), 300);
    assert.equal(metresToCm("0.1"), 10);
    assert.equal(metresToCm("0.07"), 7);
    for (const bad of ["-1", "1.234", "", "abc", "1,5", "12345"]) assert.equal(metresToCm(bad), null, bad);
    for (const cm of [0, 7, 100, 125, 99999]) assert.equal(metresToCm(cmToMetres(cm)), cm);
  });
  test("new objects start centred and inside, even in a tiny venue", () => {
    for (const [kind] of KINDS) {
      assert.equal(fits(newBox(kind, room), room), true, kind);
      assert.equal(fits(newBox(kind, { w: 120, d: 90 }), { w: 120, d: 90 }), true, `${kind} in a tiny room`);
    }
  });
});

describe("readiness", () => {
  const empty = { hasVenue: false, hasTarget: false, budgetLines: 0, overBudget: false, tasks: 0, overdueTasks: 0, quotes: 0, undecidedQuotes: 0, guests: 0, capacity: null, overCapacity: false, entries: 0, ownerClashes: 0, layoutItems: 0 };
  const full = { hasVenue: true, hasTarget: true, budgetLines: 3, overBudget: false, tasks: 5, overdueTasks: 0, quotes: 2, undecidedQuotes: 0, guests: 10, capacity: 50, overCapacity: false, entries: 6, ownerClashes: 0, layoutItems: 4 };

  test("an empty plan is 0%, passes nothing, and can never look ready", () => {
    const r = readiness(empty);
    assert.deepEqual([r.passed, r.total, r.percent], [0, 11, 0]);
    assert.ok(r.checks.every((c) => !c.done), "no check may pass on an empty plan");
  });
  test("everything satisfied is 100%", () => {
    const r = readiness(full);
    assert.deepEqual([r.passed, r.percent], [11, 100]);
  });
  test("percentage is passed / total, rounded: 9 of 11 is 82%", () => {
    const r = readiness({ ...full, overdueTasks: 2, undecidedQuotes: 1 });
    assert.deepEqual([r.passed, r.total, r.percent], [9, 11, 82]);
    assert.deepEqual(r.checks.filter((c) => !c.done).map((c) => c.id), ["overdue", "quotes"]);
  });
  test("checks that need data fail without it: no tasks means not 'nothing overdue'; no entries means not 'no clashes'", () => {
    const r = readiness({ ...empty, hasVenue: true });
    assert.equal(r.checks.find((c) => c.id === "overdue").done, false);
    assert.equal(r.checks.find((c) => c.id === "clashes").done, false);
    assert.equal(r.checks.find((c) => c.id === "within-budget").done, false);
    assert.equal(r.percent, 9); // only "venue chosen" (1/11)
  });
  test("over budget and over capacity fail their checks and say why", () => {
    const r = readiness({ ...full, overBudget: true, overCapacity: true });
    const hint = (id) => r.checks.find((c) => c.id === id).hint;
    assert.equal(r.checks.find((c) => c.id === "within-budget").done, false);
    assert.match(hint("within-budget"), /above the target/);
    assert.equal(r.checks.find((c) => c.id === "capacity").done, false);
    assert.match(hint("capacity"), /above capacity/);
  });
  test("every incomplete check points at the view that fixes it", () => {
    const r = readiness({ ...empty, hasVenue: true, tasks: 1 });
    const views = Object.fromEntries(r.checks.map((c) => [c.id, c.view]));
    assert.deepEqual(views, { venue: "layout", "budget-setup": "edit", "within-budget": "budget", tasks: "tasks", overdue: "tasks", quotes: "suppliers", guests: "guests", capacity: "edit", "run-of-show": "schedule", clashes: "schedule", layout: "layout" });
  });
});
