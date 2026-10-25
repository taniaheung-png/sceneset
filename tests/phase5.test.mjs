// Guest counts and forms, running-order ordering, overnight handling and warnings (phase 5).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseGuestForm } from "../src/lib/guestForm.ts";
import { guestSummary } from "../src/lib/guests.ts";
import { entryWarnings, parseEntryForm, sortEntries } from "../src/lib/schedule.ts";
import { crossesMidnight, formatDuration, localDate, zonedLocalToInstant } from "../src/lib/time.ts";

const g = (rsvp, party_size = 1) => ({ rsvp, party_size });
const form = (o) => ({ get: (k) => o[k] ?? null });

describe("guest summary: records are not people", () => {
  const guests = [g("confirmed", 4), g("confirmed", 1), g("tentative", 3), g("invited", 2), g("declined", 5), g("invited", 1)];
  test("counts records and people separately for every status", () => {
    const s = guestSummary(guests, 10);
    assert.deepEqual(s.records, { invited: 2, confirmed: 2, tentative: 1, declined: 1 });
    assert.deepEqual(s.people, { invited: 3, confirmed: 5, tentative: 3, declined: 5 });
    assert.equal(s.totalRecords, 6);
  });
  test("attending headcount is people on CONFIRMED records only (not records, not tentative, not declined)", () => {
    const s = guestSummary(guests, 10);
    assert.equal(s.attending, 5);
    assert.equal(s.possible, 8);
    assert.equal(s.remaining, 5);
    assert.equal(s.over, false);
    assert.equal(s.mayExceed, false);
  });
  test("over capacity, exactly at capacity, and 'could exceed if tentatives come'", () => {
    assert.equal(guestSummary([g("confirmed", 11)], 10).over, true);
    assert.equal(guestSummary([g("confirmed", 11)], 10).remaining, -1);
    const exact = guestSummary([g("confirmed", 10)], 10);
    assert.deepEqual([exact.over, exact.remaining, exact.mayExceed], [false, 0, false]);
    const may = guestSummary([g("confirmed", 8), g("tentative", 3)], 10);
    assert.deepEqual([may.over, may.mayExceed, may.possible], [false, true, 11]);
  });
  test("no capacity set: no remaining, never over; empty list is all zeros; capacity 0 is a real limit", () => {
    const none = guestSummary(guests, null);
    assert.deepEqual([none.remaining, none.over, none.mayExceed], [null, false, false]);
    const empty = guestSummary([], 50);
    assert.deepEqual([empty.attending, empty.possible, empty.totalRecords, empty.remaining, empty.over], [0, 0, 0, 50, false]);
    assert.equal(guestSummary([g("confirmed", 1)], 0).over, true);
  });
});

describe("guest form", () => {
  const ok = { name: "Amy Lee", contact: "amy@example.test", group: "Vendors", party: "3", rsvp: "confirmed", notes: "" };
  test("valid", () => {
    const r = parseGuestForm(form(ok));
    assert.deepEqual(r.data, { name: "Amy Lee", contact: "amy@example.test", group_name: "Vendors", party_size: 3, rsvp: "confirmed", notes: "" });
  });
  test("blank party size means 1; blank contact is null", () => {
    const r = parseGuestForm(form({ ...ok, party: "", contact: "" }));
    assert.equal(r.data.party_size, 1);
    assert.equal(r.data.contact, null);
  });
  test("rejects 0, negative, decimal, 51, text; unknown RSVP; blank name; keeps typed values", () => {
    for (const bad of ["0", "-2", "1.5", "51", "abc"]) assert.ok(parseGuestForm(form({ ...ok, party: bad })).errors.party, `party ${bad}`);
    const r = parseGuestForm(form({ ...ok, name: " ", rsvp: "maybe", party: "9x" }));
    assert.deepEqual(Object.keys(r.errors).sort(), ["name", "party", "rsvp"]);
    assert.equal(r.values.party, "9x");
    assert.equal(r.data, undefined);
  });
});

describe("running order", () => {
  const HK = "Asia/Hong_Kong";
  const at = (s, tz = HK) => zonedLocalToInstant(s, tz).toISOString();
  const e = (id, start, end, owner = null, title = id) => ({ id, title, starts_at: at(start), ends_at: at(end), owner_id: owner });

  test("ordering is by start, then end, then id, and is stable across calls", () => {
    const list = [e("c", "2026-11-14T18:00", "2026-11-14T19:00"), e("b", "2026-11-14T17:00", "2026-11-14T19:00"), e("a", "2026-11-14T17:00", "2026-11-14T18:00"), e("d", "2026-11-14T17:00", "2026-11-14T18:00")];
    assert.deepEqual(sortEntries(list).map((x) => x.id), ["a", "d", "b", "c"]);
    assert.deepEqual(sortEntries([...list].reverse()).map((x) => x.id), ["a", "d", "b", "c"]);
  });
  test("form: end before or equal to start is rejected, with a hint about overnight; typed values are kept", () => {
    const base = { title: "Load-in", start: "2026-11-14T15:00", end: "2026-11-14T15:00", owner: "", location: "Gate 2", notes: "" };
    const r = parseEntryForm(form(base), HK);
    assert.match(r.errors.end, /after the start/);
    assert.equal(r.values.location, "Gate 2");
    assert.ok(parseEntryForm(form({ ...base, end: "2026-11-14T14:00" }), HK).errors.end);
  });
  test("form: overnight 23:00 to 01:00 next day is valid and stored as the right UTC instants", () => {
    const r = parseEntryForm(form({ title: "Pack-down", start: "2026-11-14T23:00", end: "2026-11-15T01:00", owner: "", location: "", notes: "" }), HK);
    assert.deepEqual(r.errors, {});
    assert.equal(r.data.starts_at, "2026-11-14T15:00:00.000Z");
    assert.equal(r.data.ends_at, "2026-11-14T17:00:00.000Z");
    assert.equal(crossesMidnight(new Date(r.data.starts_at), new Date(r.data.ends_at), HK), true);
    assert.equal(formatDuration(r.data.starts_at, r.data.ends_at), "2 h");
  });
  test("timezone handling: the same wall time means different instants in different zones; DST is respected", () => {
    const f = (tz, start, end) => parseEntryForm(form({ title: "x", start, end, owner: "", location: "", notes: "" }), tz).data;
    assert.equal(f("Asia/Hong_Kong", "2026-11-14T12:00", "2026-11-14T13:00").starts_at, "2026-11-14T04:00:00.000Z");
    assert.equal(f("America/New_York", "2026-11-14T12:00", "2026-11-14T13:00").starts_at, "2026-11-14T17:00:00.000Z"); // EST
    assert.equal(f("America/New_York", "2026-07-14T12:00", "2026-07-14T13:00").starts_at, "2026-07-14T16:00:00.000Z"); // EDT
    assert.equal(localDate(new Date("2026-11-14T17:30:00Z"), "Asia/Hong_Kong"), "2026-11-15"); // already the next day in Hong Kong
    assert.equal(parseEntryForm(form({ title: "x", start: "2026-02-31T10:00", end: "2026-03-01T10:00", owner: "", location: "", notes: "" }), HK).errors.start.length > 0, true);
  });
  test("bad owner id and blank title are rejected", () => {
    const r = parseEntryForm(form({ title: " ", start: "2026-11-14T10:00", end: "2026-11-14T11:00", owner: "nope", location: "", notes: "" }), HK);
    assert.deepEqual(Object.keys(r.errors).sort(), ["owner", "title"]);
  });

  const win = ["2026-11-14T15:00", "2026-11-15T01:00"].map((s) => at(s));
  test("parallel activities are allowed: informational, not an error; back-to-back is not an overlap", () => {
    const list = [e("sound", "2026-11-14T17:00", "2026-11-14T18:00", "p1", "Sound check"), e("doors", "2026-11-14T17:30", "2026-11-14T19:00", "p2", "Doors open"), e("next", "2026-11-14T19:00", "2026-11-14T20:00", "p2", "Parade")];
    const w = entryWarnings(list, ...win);
    assert.deepEqual(w.get("sound").map((x) => x.kind), ["parallel"]);
    assert.deepEqual(w.get("doors").map((x) => x.kind), ["parallel"]);
    assert.deepEqual(w.get("next"), []); // starts exactly when "Doors open" ends
  });
  test("the same person on overlapping entries is a real warning", () => {
    const list = [e("a", "2026-11-14T17:00", "2026-11-14T18:00", "p1", "Setup"), e("b", "2026-11-14T17:30", "2026-11-14T18:30", "p1", "Briefing")];
    const w = entryWarnings(list, ...win);
    assert.deepEqual([w.get("a")[0].kind, w.get("b")[0].kind], ["owner-clash", "owner-clash"]);
  });
  test("entries outside the event window are flagged (before, after, both) but remain valid; an overnight event window is respected", () => {
    const list = [e("early", "2026-11-14T14:00", "2026-11-14T15:30"), e("late", "2026-11-15T00:30", "2026-11-15T02:00"), e("wide", "2026-11-14T10:00", "2026-11-15T03:00"), e("inside", "2026-11-14T23:00", "2026-11-15T00:30")];
    const w = entryWarnings(list, ...win);
    assert.ok(w.get("early").some((x) => x.kind === "before-window"));
    assert.ok(w.get("late").some((x) => x.kind === "after-window"));
    assert.ok(["before-window", "after-window"].every((k) => w.get("wide").some((x) => x.kind === k)));
    assert.deepEqual(w.get("inside").filter((x) => x.kind.endsWith("window")), []);
  });
  test("an empty list and a single entry produce no warnings", () => {
    assert.equal(entryWarnings([], ...win).size, 0);
    assert.deepEqual(entryWarnings([e("only", "2026-11-14T16:00", "2026-11-14T17:00")], ...win).get("only"), []);
  });
  test("durations", () => {
    assert.equal(formatDuration(at("2026-11-14T16:00"), at("2026-11-14T16:45")), "45 min");
    assert.equal(formatDuration(at("2026-11-14T16:00"), at("2026-11-14T17:30")), "1 h 30 min");
    assert.equal(formatDuration(at("2026-11-14T16:00"), at("2026-11-14T15:00")), "0 min");
  });
});
