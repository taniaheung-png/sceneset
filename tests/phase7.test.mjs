// Plans and entitlement rules (phase 7). The SQL side of the same limits is tested in supabase/tests/rls.local.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { IDEMPOTENCY_KEY, PLANS, brandingFree, canAddEvent, canAddMember, entitlement, isPlanId, limitText, resultFromError, sandboxEnabled } from "../src/lib/entitlements.ts";

describe("entitlements", () => {
  test("free: one active event and three members", () => {
    const e = entitlement("free", 0);
    assert.deepEqual([e.tier, e.maxEvents, e.maxMembers], ["free", 1, 3]);
    assert.equal(canAddEvent(e, 0), true);
    assert.equal(canAddEvent(e, 1), false);
    assert.equal(canAddMember(e, 2), true);
    assert.equal(canAddMember(e, 3), false);
  });
  test("an upgraded event raises members to ten and leaves the event limit alone", () => {
    const e = entitlement("free", 1);
    assert.deepEqual([e.tier, e.maxEvents, e.maxMembers], ["event", 1, 10]);
    assert.equal(canAddMember(e, 9), true);
    assert.equal(canAddMember(e, 10), false);
    assert.equal(canAddEvent(e, 1), false);
    assert.equal(entitlement("free", 5).maxMembers, 10); // more upgrades do not stack
  });
  test("organiser is unlimited, with or without upgraded events", () => {
    for (const n of [0, 3]) {
      const e = entitlement("organiser", n);
      assert.deepEqual([e.tier, e.maxEvents, e.maxMembers], ["organiser", null, null]);
      assert.equal(canAddEvent(e, 500), true);
      assert.equal(canAddMember(e, 500), true);
    }
  });
  test("an unknown plan value is treated as free, never as paid", () => {
    for (const p of ["", "enterprise", "ORGANISER", "event", "true"]) assert.equal(entitlement(p, 0).tier, "free");
  });
  test("branding-free printing needs an upgraded event or Organiser", () => {
    assert.equal(brandingFree("free", false), false);
    assert.equal(brandingFree("free", true), true);
    assert.equal(brandingFree("organiser", false), true);
  });
  test("plan ids: only the two sellable plans are known", () => {
    assert.equal(isPlanId("event"), true);
    assert.equal(isPlanId("organiser"), true);
    for (const v of ["free", "Event", "", null, undefined, 1, {}, "event ", "organiser;"]) assert.equal(isPlanId(v), false);
  });
  test("request keys: random-looking tokens only", () => {
    assert.equal(IDEMPOTENCY_KEY.test("0123456789abcdef"), true);
    assert.equal(IDEMPOTENCY_KEY.test("short"), false);
    assert.equal(IDEMPOTENCY_KEY.test("0123456789abcdef!"), false);
    assert.equal(IDEMPOTENCY_KEY.test("a".repeat(65)), false);
  });
  test("database error codes map to fixed result keys", () => {
    assert.equal(resultFromError("42501"), "forbidden");
    assert.equal(resultFromError("22023"), "invalid");
    assert.equal(resultFromError("P0002"), "invalid");
    assert.equal(resultFromError("P0001"), "covered");
    assert.equal(resultFromError(undefined), "error");
    assert.equal(limitText(null), "unlimited");
    assert.equal(limitText(3), "3");
  });
});

describe("the sandbox switch", () => {
  test("it is on only when explicitly set to the exact string true", () => {
    assert.equal(sandboxEnabled({ PAYMENT_SANDBOX_ENABLED: "true" }), true);
    for (const v of [undefined, "", "false", "TRUE", "True", "1", "yes", " true"]) assert.equal(sandboxEnabled({ PAYMENT_SANDBOX_ENABLED: v }), false, String(v));
    assert.equal(sandboxEnabled({}), false);
  });
  test("the example environment ships with it off, and no payment provider or card code exists in the source", () => {
    assert.match(readFileSync(new URL("../.env.example", import.meta.url), "utf8"), /^PAYMENT_SANDBOX_ENABLED=false$/m);
    const pkg = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    assert.doesNotMatch(pkg, /stripe|paypal|braintree|adyen|square/i);
  });
});

describe("plan descriptions match the PRD", () => {
  const prd = readFileSync(new URL("../PRD.md", import.meta.url), "utf8");
  test("prices and cadence", () => {
    const by = Object.fromEntries(PLANS.map((p) => [p.id, p]));
    assert.deepEqual([by.free.price, by.event.price, by.organiser.price], ["HKD 0", "HKD 149", "HKD 299"]);
    assert.match(by.event.cadence, /per event/);
    assert.match(by.organiser.cadence, /per month/);
    assert.ok(prd.includes("HKD 149") && prd.includes("HKD 299"));
  });
  test("the limits printed on the plans are the limits in the rules", () => {
    const free = PLANS[0].points.join(" ");
    assert.match(free, /1 active event/);
    assert.match(free, /3 members/);
    assert.match(PLANS[1].points.join(" "), /10 members/);
    assert.match(PLANS[2].points.join(" "), /Unlimited active events/);
    assert.match(PLANS[2].points.join(" "), /Unlimited members/);
  });
});
