// Pure-logic checks for money and time helpers. Run via `npm test` (Node strips the .ts types).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatMinor, parseMajorToMinor } from "../src/lib/money.ts";
import { parseEventForm } from "../src/lib/eventForm.ts";
import { crossesMidnight, todayIn, toLocalInput, zonedLocalToInstant } from "../src/lib/time.ts";

describe("money", () => {
  test("parses valid amounts to integer minor units", () => {
    assert.equal(parseMajorToMinor("1,234.56"), 123456);
    assert.equal(parseMajorToMinor("12"), 1200);
    assert.equal(parseMajorToMinor("12.5"), 1250);
    assert.equal(parseMajorToMinor("0"), 0);
    assert.equal(parseMajorToMinor(" 80,000 "), 8_000_000);
    assert.equal(parseMajorToMinor("0.07"), 7); // no 0.07*100 float error
    assert.equal(parseMajorToMinor("19.99"), 1999);
  });
  test("rejects negatives, extra decimals, bad grouping, text and empty", () => {
    for (const bad of ["-1", "1.234", "1,23", "12,34.5", "abc", "", "1e3", "1.", ".5", "9".repeat(20)]) {
      assert.equal(parseMajorToMinor(bad), null, `should reject ${JSON.stringify(bad)}`);
    }
  });
  test("formats without hiding cents", () => {
    const f = (n) => formatMinor(n, "HKD").replace(/\s/g, " ");
    assert.equal(f(8_000_000), "HKD 80,000");
    assert.equal(f(123456), "HKD 1,234.56");
    assert.equal(f(0), "HKD 0");
    assert.equal(f(5), "HKD 0.05");
  });
});

describe("time", () => {
  test("converts local event time to the right UTC instant", () => {
    assert.equal(zonedLocalToInstant("2026-11-14T23:00", "Asia/Hong_Kong")?.toISOString(), "2026-11-14T15:00:00.000Z");
    assert.equal(zonedLocalToInstant("2026-01-15T09:00", "America/New_York")?.toISOString(), "2026-01-15T14:00:00.000Z"); // EST
    assert.equal(zonedLocalToInstant("2026-03-08T12:00", "America/New_York")?.toISOString(), "2026-03-08T16:00:00.000Z"); // EDT after the change
  });
  test("rejects bad input and unknown zones", () => {
    assert.equal(zonedLocalToInstant("2026-02-31T10:00", "Asia/Hong_Kong"), null);
    assert.equal(zonedLocalToInstant("not a date", "Asia/Hong_Kong"), null);
    assert.equal(zonedLocalToInstant("2026-11-14T10:00", "Mars/Base"), null);
  });
  test("detects activities that run past midnight in the event timezone", () => {
    const hk = "Asia/Hong_Kong";
    const at = (s) => zonedLocalToInstant(s, hk);
    assert.equal(crossesMidnight(at("2026-11-14T23:00"), at("2026-11-15T01:00"), hk), true);
    assert.equal(crossesMidnight(at("2026-11-14T10:00"), at("2026-11-14T18:00"), hk), false);
    assert.equal(crossesMidnight(at("2026-11-14T18:00"), at("2026-11-14T10:00"), hk), false); // invalid range is not "overnight"
    // 18:00 UTC is already the next day in Hong Kong (02:00): the zone, not UTC, decides.
    assert.equal(crossesMidnight(new Date("2026-11-14T15:00:00Z"), new Date("2026-11-14T17:00:00Z"), hk), true);
  });
});

describe("time (event form helpers)", () => {
  test("toLocalInput is the inverse of zonedLocalToInstant", () => {
    for (const [local, tz] of [["2026-11-14T23:00", "Asia/Hong_Kong"], ["2026-03-08T12:30", "America/New_York"], ["2026-12-31T00:00", "UTC"]]) {
      assert.equal(toLocalInput(zonedLocalToInstant(local, tz), tz), local);
    }
  });
  test("todayIn follows the zone, not UTC", () => {
    const now = new Date("2026-11-14T17:00:00Z"); // 01:00 on the 15th in Hong Kong
    assert.equal(todayIn("Asia/Hong_Kong", now), "2026-11-15");
    assert.equal(todayIn("UTC", now), "2026-11-14");
  });
});

describe("event form validation", () => {
  const form = (o) => ({ get: (k) => o[k] ?? null });
  const good = { title: "Harbour Night Market", type: "Pop-up market", goals: "Sell out", start: "2026-11-14T15:00", end: "2026-11-14T23:30", timezone: "Asia/Hong_Kong", currency: "HKD", capacity: "150", budget: "80,000", status: "planning" };

  test("accepts a valid form and converts to instants and minor units", () => {
    const r = parseEventForm(form(good));
    assert.deepEqual(r.errors, {});
    assert.equal(r.data.starts_at, "2026-11-14T07:00:00.000Z");
    assert.equal(r.data.budget_target_minor, 8_000_000);
    assert.equal(r.data.capacity, 150);
    assert.equal(r.data.venue_id, null);
  });
  test("blank optional fields are fine; overnight end is accepted", () => {
    const r = parseEventForm(form({ ...good, capacity: "", budget: "", end: "2026-11-15T02:00" }));
    assert.deepEqual(r.errors, {});
    assert.equal(r.data.capacity, null);
    assert.equal(r.data.budget_target_minor, 0);
  });
  test("reports each problem and keeps the typed values", () => {
    const r = parseEventForm(form({ ...good, title: " ", end: "2026-11-14T10:00", capacity: "-3", budget: "12.345" }));
    assert.deepEqual(Object.keys(r.errors).sort(), ["budget", "capacity", "end", "title"]);
    assert.equal(r.values.budget, "12.345");
    assert.equal(r.data, undefined);
  });
  test("rejects unknown timezone, currency, type and a forged venue id", () => {
    const r = parseEventForm(form({ ...good, timezone: "Mars/Base", currency: "XXX", type: "Rave", venue: "not-a-uuid" }));
    assert.ok(r.errors.timezone && r.errors.currency && r.errors.type && r.errors.venue);
  });
  test("a new venue is entered in metres and stored in centimetres", () => {
    const r = parseEventForm(form({ ...good, venueName: "Pier 9", venueWidth: "20.5", venueDepth: "15" }));
    assert.deepEqual(r.newVenue, { name: "Pier 9", width_cm: 2050, depth_cm: 1500 });
    assert.ok(parseEventForm(form({ ...good, venueName: "Pier 9", venueWidth: "0", venueDepth: "15" })).errors.venueWidth);
  });
});
