// Browser checks for phase 5: guest list (records vs people, RSVP, filters, capacity warnings, edit, delete),
// running order (ordering, overnight, parallel entries, warnings, edit, delete), dashboard summaries,
// permissions, isolation, persistence, keyboard operation and responsive layout.
// One isolated browser context per role. Needs the dev server on :3000 and the disposable accounts:
//   $env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e:p5
import { chromium } from "playwright";
import { grantOrganiser } from "./admin.mjs";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.DEV_USERS_PASSWORD;
if (!PASSWORD) {
  console.error("Set DEV_USERS_PASSWORD to the password printed by `npm run dev:users -- create`.");
  process.exit(2);
}
const email = (r) => `dev-${r}@example.test`;
const browser = await chromium.launch();
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push([name, true]);
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push([name, false]);
    console.log(`FAIL ${name}\n     ${String(e.message).split("\n")[0]}`);
    if (process.env.E2E_VERBOSE) {
      console.log(String(e.stack).split("\n").slice(0, 6).join("\n"));
      console.log("--- owner page text:", (await owner.locator("main").innerText().catch(() => "")).slice(0, 1500));
    }
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ baseURL: BASE, ...opts });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  return { ctx, page };
};
const open = async (page, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  // Workspace pages stream: the loading fallback shows first and the page replaces it moments later. Read nothing before it has.
  await page.waitForFunction(() => ![...document.querySelectorAll("[role=status]")].some((e) => e.textContent.includes("Loading…")) && !document.querySelector('div[hidden][id^="S:"]'));
};
const signIn = async (page, role, next) => {
  await open(page, next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email(role));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !["/login", "/app"].includes(u.pathname));
  await page.waitForLoadState("networkidle");
};
/** Click a submit control and wait for the server-action POST and the render that follows. */
const submit = async (page, locator) => {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), locator.click()]);
  await page.waitForLoadState("networkidle");
};
const text = async (loc) => (await loc.innerText()).replace(/\s+/g, " ");
const notFound = async (page, path) => {
  await open(page, path);
  await page.getByText("Page not found").waitFor();
};
/** Wait for React to reset an add-form after the previous action, so a fresh fill is not wiped. */
const empty = (page, selector) => page.waitForFunction((s) => document.querySelector(s)?.value === "", selector);

const A = { owner: await newPage(), organiser: await newPage(), collab: await newPage(), outsider: await newPage() };
const owner = A.owner.page;
let ws, ev, base;

// ---- guests helpers
const guestSection = () => owner.locator("section[aria-labelledby=add-guest]");
const addGuest = async (name, { party = "1", rsvp = "invited", group = "", contact = "" } = {}) => {
  await empty(owner, "section[aria-labelledby=add-guest] input[name=name]");
  const f = guestSection();
  await f.getByLabel("Guest or party name").fill(name);
  if (contact) await f.getByLabel("Contact detail").fill(contact);
  if (group) await f.getByLabel("Group").fill(group);
  await f.getByLabel("People in this party").fill(party);
  await f.getByLabel("RSVP status").selectOption(rsvp);
  await submit(owner, f.getByRole("button", { name: "Add guest" }));
  await owner.locator(`[data-guest="${name}"]`).waitFor(); // the banner text is stale from the previous add; wait for this guest's own row
};
const summary = async (page) => {
  const t = await text(page.locator('section[aria-label="Guest summary (all guests)"]'));
  const row = (label) => {
    const m = new RegExp(`${label} (\\d+) (\\d+)`).exec(t);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const n = (re) => Number(re.exec(t)?.[1] ?? NaN);
  return {
    invited: row("Invited \\(no reply yet\\)"), confirmed: row("Confirmed"), tentative: row("Tentative"), declined: row("Declined"), all: row("All guests"),
    attending: n(/Attending headcount \(confirmed people\) (\d+)/), possible: n(/\(confirmed \+ tentative\) (\d+)/), left: n(/Places left (\d+)/), over: n(/Over capacity by (\d+)/), text: t,
  };
};
const mark = async (name, label, status) => {
  await submit(owner, owner.locator(`[data-guest="${name}"]`).getByRole("button", { name: label }));
  // wait for the row to show the new status (the banner text is stale from the previous change)
  await owner.waitForFunction(([n, s]) => document.querySelector(`[data-guest="${n}"]`)?.innerText.includes(s), [name, status]);
};

// ---- schedule helpers
const entrySection = () => owner.locator("section[aria-labelledby=add-entry]");
const addEntry = async (title, start, end, { owner: who = "", location = "" } = {}) => {
  await empty(owner, "section[aria-labelledby=add-entry] input[name=title]");
  const f = entrySection();
  await f.getByLabel("Activity").fill(title);
  await f.getByLabel("Starts").fill(start);
  await f.getByLabel("Ends").fill(end);
  if (who) await f.getByLabel("Responsible person").selectOption({ label: who });
  if (location) await f.getByLabel("Location").fill(location);
  await submit(owner, f.getByRole("button", { name: "Add entry" }));
  await owner.locator(`[data-entry="${title}"]`).waitFor(); // wait for this entry's own row (the banner text is stale)
};
const titles = async (page) => page.locator("[data-entry]").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-entry")));

try {
  // ------------------------------------------------------------------ setup
  await step("setup: workspace, organiser and collaborator, and an overnight event with capacity 10", async () => {
    await signIn(owner, "owner");
    await owner.getByLabel("Workspace name").fill("P5 Guests Co");
    await owner.getByRole("button", { name: "Create workspace" }).click();
    await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    ws = /\/w\/([0-9a-f-]{36})\//.exec(owner.url())[1];
    await grantOrganiser(ws); // plan limits are tested in phase7.mjs; this suite creates several events
    await open(owner, `/w/${ws}/settings`);
    for (const [mail, role] of [[email("organiser"), "organiser"], [email("collaborator"), "collaborator"]]) {
      const form = owner.locator("form:has(input[name=email])");
      await form.getByLabel("Add a member by email").fill(mail);
      await form.getByLabel("Role").selectOption(role);
      await submit(owner, form.getByRole("button", { name: "Add member" }));
      await owner.getByText("Member added.").waitFor();
    }
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("Guest Gala");
    await owner.getByLabel("Starts").fill("2026-11-14T15:00");
    await owner.getByLabel("Ends").fill("2026-11-15T01:00");
    await owner.getByLabel("Capacity").fill("10");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\?m=created$/);
    ev = /\/events\/([0-9a-f-]{36})/.exec(owner.url())[1];
    base = `/w/${ws}/events/${ev}`;
  });
  await step("empty guest list, running order and dashboard cards explain what to do; collection notice shows on the guest form", async () => {
    await open(owner, `${base}/guests`);
    await owner.getByText("No guests yet").first().waitFor();
    await owner.getByText("is stored in your workspace to run your plan").first().waitFor();
    assert((await owner.getByRole("link", { name: "privacy notice" }).count()) > 0, "no privacy link on the guest form");
    await open(owner, `${base}/schedule`);
    await owner.getByText("No running order yet").waitFor();
    await open(owner, base);
    await owner.getByText("No guests yet.").waitFor();
    await owner.getByText("No running order yet.").waitFor();
  });

  // ------------------------------------------------------------------ guests (P5.1 - P5.4)
  await step("guest form: invalid input shows errors, keeps typed values and the chosen RSVP, and saves nothing", async () => {
    await open(owner, `${base}/guests`);
    const f = guestSection();
    await f.getByLabel("Guest or party name").fill("   ");
    await f.getByLabel("Contact detail").fill("keep-me@example.test");
    await f.getByLabel("People in this party").fill("0");
    await f.getByLabel("RSVP status").selectOption("tentative");
    await submit(owner, f.getByRole("button", { name: "Add guest" }));
    await f.getByText("Enter a name of 1 to 120 characters.").waitFor();
    await f.getByText("Enter a whole number of people from 1 to 50.").waitFor();
    assert((await f.getByLabel("Contact detail").inputValue()) === "keep-me@example.test", "contact lost");
    assert((await f.getByLabel("RSVP status").inputValue()) === "tentative", "chosen RSVP reverted after the error");
    await owner.getByText("No guests yet").first().waitFor();
  });
  await step("five guests are added; records and people are counted separately; attending headcount is confirmed people only", async () => {
    await open(owner, `${base}/guests`);
    await addGuest("Amy Party", { party: "4", rsvp: "confirmed", group: "Friends", contact: "amy@example.test" });
    await addGuest("Ben", { party: "1", rsvp: "confirmed", group: "Vendors" });
    await addGuest("Cara Group", { party: "3", rsvp: "tentative", group: "Friends" });
    await addGuest("Dev Press", { party: "2", rsvp: "invited", group: "Press" });
    await addGuest("Eve", { party: "5", rsvp: "declined", group: "Friends" });
    const s = await summary(owner);
    assert(JSON.stringify([s.invited, s.confirmed, s.tentative, s.declined, s.all]) === JSON.stringify([[1, 2], [2, 5], [1, 3], [1, 5], [5, 15]]), `records/people wrong: ${s.text}`);
    assert(s.attending === 5, `attending headcount should be 5 people (not 2 records): ${s.attending}`);
    assert(s.possible === 8 && s.left === 5, `possible/left wrong: ${s.possible}/${s.left}`);
    assert((await owner.getByText(/Over capacity/).count()) === 0 && (await owner.getByText(/Would exceed|if every tentative/).count()) === 0, "unexpected capacity warning");
  });
  await step("search, RSVP and group filters narrow the list but never change the summary; clear and no-results work", async () => {
    const before = (await summary(owner)).text;
    await open(owner, `${base}/guests?q=amy`);
    assert((await owner.locator("[data-guest]").count()) === 1, "search should find one guest");
    await owner.getByText(/Showing 1 of 5 guest records \(4 people\)/).waitFor();
    assert((await summary(owner)).text === before, "summary changed when searching");
    await open(owner, `${base}/guests?rsvp=confirmed`);
    assert((await owner.locator("[data-guest]").count()) === 2, "RSVP filter wrong");
    await open(owner, `${base}/guests?group=Friends`);
    assert((await owner.locator("[data-guest]").count()) === 3, "group filter wrong");
    await owner.getByText(/Showing 3 of 5 guest records \(12 people\)/).waitFor();
    assert((await summary(owner)).text === before, "summary changed when filtering by group");
    await open(owner, `${base}/guests?q=zzz-nobody`);
    await owner.getByText("No guests match").waitFor();
    await owner.getByRole("link", { name: "Clear filters" }).first().click();
    await owner.waitForURL(/\/guests$/);
    await owner.locator("[data-guest]").first().waitFor();
    assert((await owner.locator("[data-guest]").count()) === 5, "clear did not restore the list");
  });
  await step("RSVP changes update the headcount; exactly at capacity is fine; over capacity and 'could exceed' warn", async () => {
    await open(owner, `${base}/guests`);
    await mark("Cara Group", "Mark confirmed", "Confirmed");
    let s = await summary(owner);
    assert(s.attending === 8 && s.left === 2, `after Cara: ${s.attending}/${s.left}`);
    await mark("Dev Press", "Mark confirmed", "Confirmed");
    s = await summary(owner);
    assert(s.attending === 10 && s.left === 0, `exactly at capacity: ${s.attending}/${s.left}`);
    assert((await owner.getByText(/Over capacity/).count()) === 0, "at capacity must not be flagged as over");
    await mark("Eve", "Mark tentative", "Tentative");
    await owner.getByText(/if every tentative guest comes there would be 15 people for a capacity of 10/).waitFor();
    await mark("Eve", "Mark declined", "Declined");
    // grow Amy's party by one: now over capacity
    const row = owner.locator('[data-guest="Amy Party"]');
    await row.getByText("Edit guest").click();
    await row.getByLabel("People in this party").fill("5");
    await submit(owner, row.getByRole("button", { name: "Save guest" }));
    await owner.getByText("Guest saved.").waitFor();
    await owner.getByText("Over capacity by 1").first().waitFor();
    s = await summary(owner);
    assert(s.attending === 11 && s.over === 1, `over capacity: ${s.attending}/${s.over}`);
  });
  await step("dashboard guest card equals the Guests page and flags over capacity", async () => {
    await open(owner, base);
    const d = await text(owner.locator("section[aria-labelledby=d-guests]"));
    assert(/11 people attending \(confirmed\) of 10 capacity/.test(d), d);
    assert(/Over capacity by 1/.test(d), d);
    assert(/5 guest records: 4 confirmed, 0 tentative, 0 awaiting a reply, 1 declined/.test(d), d);
  });
  await step("editing persists after reload; a stale second tab is refused; delete needs confirmation and updates counts", async () => {
    await open(owner, `${base}/guests`);
    const a = await owner.context().newPage();
    const b = await owner.context().newPage();
    for (const p of [a, b]) {
      await open(p, `${base}/guests`);
      await p.locator('[data-guest="Amy Party"]').getByText("Edit guest").click();
    }
    const row = (p) => p.locator('[data-guest="Amy Party"]');
    await row(a).getByLabel("People in this party").fill("4");
    await submit(a, row(a).getByRole("button", { name: "Save guest" }));
    await a.getByText("Guest saved.").waitFor();
    await row(b).getByLabel("People in this party").fill("9");
    await row(b).getByRole("button", { name: "Save guest" }).click();
    await b.getByText("changed by someone else").waitFor();
    await open(b, `${base}/guests`);
    assert(/Amy Party.*4/.test(await text(b.locator('[data-guest="Amy Party"]'))), "first save was overwritten");
    await a.close();
    await b.close();
    await open(owner, `${base}/guests`);
    assert((await summary(owner)).attending === 10, "attending should be back to 10");
    await owner.locator('[data-guest="Dev Press"]').getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete guest" }).click();
    await owner.getByText("Guest deleted.").waitFor();
    const s = await summary(owner);
    assert(s.attending === 8 && s.all[0] === 4, `after delete: ${s.attending}, ${s.all}`);
  });
  await step("keyboard only: a guest can be added with Tab and Enter", async () => {
    await open(owner, `${base}/guests`);
    await owner.getByLabel("Guest or party name").last().focus();
    await owner.keyboard.type("Keyboard Kim");
    await owner.keyboard.press("Tab"); // contact
    await owner.keyboard.press("Tab"); // group
    await owner.keyboard.type("Press");
    await owner.keyboard.press("Tab"); // people
    await owner.keyboard.press("Control+A");
    await owner.keyboard.type("2");
    await owner.keyboard.press("Tab"); // RSVP
    await owner.keyboard.press("Tab"); // notes
    await owner.keyboard.press("Tab"); // the privacy-notice link in the collection notice
    await owner.keyboard.press("Tab"); // submit button
    await Promise.all([owner.waitForResponse((r) => r.request().method() === "POST"), owner.keyboard.press("Enter")]);
    await owner.waitForLoadState("networkidle");
    await owner.getByText("Guest added.").waitFor();
    assert(/Keyboard Kim.*Press.*2/.test(await text(owner.locator('[data-guest="Keyboard Kim"]'))), "keyboard-added guest wrong");
    // remove it again so later counts are predictable
    await owner.locator('[data-guest="Keyboard Kim"]').getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete guest" }).click();
    await owner.getByText("Guest deleted.").waitFor();
  });

  // ------------------------------------------------------------------ run of show (P5.5 - P5.8)
  await step("entry form: end before start is rejected with an overnight hint; typed values and chosen person are kept; nothing saved", async () => {
    await open(owner, `${base}/schedule`);
    const f = entrySection();
    await f.getByLabel("Activity").fill("Bad entry");
    await f.getByLabel("Starts").fill("2026-11-14T18:00");
    await f.getByLabel("Ends").fill("2026-11-14T17:00");
    await f.getByLabel("Responsible person").selectOption({ label: "Dev organiser" });
    await f.getByLabel("Location").fill("Gate 9");
    await submit(owner, f.getByRole("button", { name: "Add entry" }));
    await f.getByText(/The end must be after the start/).waitFor();
    await f.getByText(/set the end to the next day/).waitFor();
    assert((await f.getByLabel("Location").inputValue()) === "Gate 9", "location lost");
    assert((await f.getByLabel("Starts").inputValue()) === "2026-11-14T18:00", "start lost");
    assert((await f.getByLabel("Responsible person").locator("option:checked").innerText()) === "Dev organiser", "chosen person reverted");
    await owner.getByText("No running order yet").waitFor();
    // equal start and end is also invalid
    await f.getByLabel("Ends").fill("2026-11-14T18:00");
    await submit(owner, f.getByRole("button", { name: "Add entry" }));
    await f.getByText(/The end must be after the start/).waitFor();
  });
  await step("entries are saved in any order but shown chronologically; overnight shows +1 day, Overnight and the duration", async () => {
    await open(owner, `${base}/schedule`);
    await addEntry("Pack-down", "2026-11-14T23:00", "2026-11-15T01:00", { owner: "Dev organiser", location: "Courtyard" });
    await addEntry("Doors open", "2026-11-14T18:00", "2026-11-14T23:30", { owner: "Dev collaborator" });
    await addEntry("Load-in", "2026-11-14T15:00", "2026-11-14T17:00", { owner: "Dev organiser", location: "Gate 2" });
    await addEntry("Sound check", "2026-11-14T17:00", "2026-11-14T18:30", { owner: "Dev owner" });
    const order = await titles(owner);
    assert(JSON.stringify(order) === JSON.stringify(["Load-in", "Sound check", "Doors open", "Pack-down"]), `order: ${order}`);
    const night = await text(owner.locator('[data-entry="Pack-down"]'));
    assert(/23:00 to 01:00/.test(night) && /\(\+1 day\)/.test(night) && /Overnight/.test(night) && /2 h/.test(night), night);
    assert(/15:00 to 17:00/.test(await text(owner.locator('[data-entry="Load-in"]'))), "load-in time wrong");
    await owner.getByText("Saturday 14 November").first().waitFor();
  });
  await step("parallel activities are allowed and only informational; same person on overlapping entries and entries outside the window are warned, not blocked", async () => {
    await addEntry("Lantern parade", "2026-11-14T19:30", "2026-11-14T20:15", { owner: "Dev organiser" });
    await addEntry("Briefing", "2026-11-14T19:45", "2026-11-14T20:30", { owner: "Dev organiser" }); // same person, overlapping
    await addEntry("Early setup", "2026-11-14T13:00", "2026-11-14T14:30"); // before the event window starts at 15:00
    const order = await titles(owner);
    assert(JSON.stringify(order) === JSON.stringify(["Early setup", "Load-in", "Sound check", "Doors open", "Lantern parade", "Briefing", "Pack-down"]), `order: ${order}`);
    assert(/Runs in parallel with "Doors open"/.test(await text(owner.locator('[data-entry="Sound check"]'))), "parallel note missing");
    assert(/Same person is responsible for "Briefing"/.test(await text(owner.locator('[data-entry="Lantern parade"]'))), "owner clash missing");
    assert(/Starts before the event starts/.test(await text(owner.locator('[data-entry="Early setup"]'))), "window warning missing");
    assert(!/Same person|Starts before|Ends after/.test(await text(owner.locator('[data-entry="Load-in"]'))), "Load-in should have no warning");
    const checks = await text(owner.locator('section[aria-label="Running order checks"]'));
    assert(/1 entry is outside the event window/.test(checks) && /2 entries have the same person responsible/.test(checks), checks);
  });
  await step("editing an entry persists; a stale second tab is refused; delete needs confirmation", async () => {
    const a = await owner.context().newPage();
    const b = await owner.context().newPage();
    for (const p of [a, b]) {
      await open(p, `${base}/schedule`);
      await p.locator('[data-entry="Load-in"]').getByText("Edit entry").click();
    }
    const row = (p) => p.locator('[data-entry="Load-in"]');
    await row(a).getByLabel("Location").fill("Gate 3");
    await submit(a, row(a).getByRole("button", { name: "Save entry" }));
    await a.getByText("Entry saved.").waitFor();
    await row(b).getByLabel("Location").fill("Stale gate");
    await row(b).getByRole("button", { name: "Save entry" }).click();
    await b.getByText("changed by someone else").waitFor();
    await open(b, `${base}/schedule`);
    assert((await text(b.locator('[data-entry="Load-in"]'))).includes("Gate 3"), "first save was overwritten");
    await a.close();
    await b.close();
    await open(owner, `${base}/schedule`);
    await owner.locator('[data-entry="Early setup"]').getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete entry" }).click();
    await owner.getByText("Entry deleted.").waitFor();
    assert((await titles(owner)).length === 6, "entry count wrong after delete");
    assert(!/outside the event window/.test(await text(owner.locator('section[aria-label="Running order checks"]'))), "outside-window warning should be gone");
  });
  await step("dashboard run-of-show card equals the running order and repeats its warnings", async () => {
    await open(owner, base);
    const d = await text(owner.locator("section[aria-labelledby=d-ros]"));
    assert(/6 entries/.test(d), d);
    assert(/Load-in.*Sound check.*Doors open/.test(d), `first three should be Load-in, Sound check, Doors open: ${d}`);
    assert(/2 with the same person on overlapping entries/.test(d), d);
  });

  await step("timezones: in a New York event, entry times and the event window agree (12:00 is inside, 11:00 is before), and shown in New York time", async () => {
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("NY Night");
    await owner.getByLabel("Timezone").selectOption("America/New_York");
    await owner.getByLabel("Starts").fill("2026-11-14T12:00");
    await owner.getByLabel("Ends").fill("2026-11-14T22:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\?m=created$/);
    const nyBase = `/w/${ws}/events/${/\/events\/([0-9a-f-]{36})/.exec(owner.url())[1]}`;
    await open(owner, `${nyBase}/schedule`);
    await addEntry("Opening", "2026-11-14T12:00", "2026-11-14T13:00");
    await addEntry("Too early", "2026-11-14T11:00", "2026-11-14T11:30");
    assert(/12:00 to 13:00/.test(await text(owner.locator('[data-entry="Opening"]'))), "Opening shown in the wrong zone");
    assert(!/event starts|event ends/.test(await text(owner.locator('[data-entry="Opening"]'))), "Opening should be inside the window");
    assert(/Starts before the event starts/.test(await text(owner.locator('[data-entry="Too early"]'))), "11:00 NY should be before a 12:00 NY start");
    await owner.getByText("America/New_York").first().waitFor();
    // the same wall-clock time in the Hong Kong event is a different instant: its entries do not appear here
    assert((await owner.locator('[data-entry="Load-in"]').count()) === 0, "entries leaked across events");
  });

  // ------------------------------------------------------------------ permissions, isolation, persistence
  await step("organiser can manage; collaborator can read guests and the running order but has no add, edit, RSVP or delete controls", async () => {
    const o = A.organiser.page;
    await signIn(o, "organiser", `${base}/guests`);
    await o.locator("section[aria-labelledby=add-guest]").waitFor();
    await open(o, `${base}/schedule`);
    await o.locator("section[aria-labelledby=add-entry]").waitFor();

    const c = A.collab.page;
    await signIn(c, "collaborator", `${base}/guests`);
    await c.locator("[data-guest]").first().waitFor();
    assert((await summary(c)).attending === 8, "collaborator sees different totals");
    for (const [name, role] of [["Edit guest", "text"], ["Mark confirmed", "button"], ["Delete", "button"]]) {
      const n = role === "text" ? await c.getByText(name, { exact: true }).count() : await c.getByRole("button", { name }).count();
      assert(n === 0, `${name} visible to a collaborator`);
    }
    assert((await c.locator("section[aria-labelledby=add-guest]").count()) === 0, "add-guest form visible");
    await open(c, `${base}/schedule`);
    await c.locator("[data-entry]").first().waitFor();
    assert((await c.locator("section[aria-labelledby=add-entry]").count()) === 0 && (await c.getByText("Edit entry", { exact: true }).count()) === 0 && (await c.getByRole("button", { name: "Delete" }).count()) === 0, "schedule controls visible");
    await open(owner, `${base}/schedule`);
  });
  await step("outsiders get 'Page not found' for the guest list and running order", async () => {
    const p = A.outsider.page;
    await signIn(p, "outsider");
    await p.getByLabel("Workspace name").fill("Outsider Co");
    await p.getByRole("button", { name: "Create workspace" }).click();
    await p.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    for (const path of [`${base}/guests`, `${base}/schedule`]) await notFound(p, path);
  });
  await step("data and totals persist after sign-out and sign-in", async () => {
    await open(owner, `${base}/guests`);
    const before = (await summary(owner)).text;
    const order = await titles((await open(owner, `${base}/schedule`), owner));
    await owner.getByRole("button", { name: "Sign out" }).click();
    await owner.waitForURL((u) => u.pathname === "/");
    await signIn(owner, "owner", `${base}/guests`);
    assert((await summary(owner)).text === before, "guest summary changed after re-login");
    await open(owner, `${base}/schedule`);
    assert(JSON.stringify(await titles(owner)) === JSON.stringify(order), "running order changed after re-login");
  });
  await step("responsive: no page-level horizontal overflow at 375, 768, 1024 and 1440 px (tables scroll inside their own container)", async () => {
    const state = await owner.context().storageState();
    for (const width of [375, 768, 1024, 1440]) {
      const { ctx, page } = await newPage({ viewport: { width, height: 800 }, storageState: state });
      for (const path of [base, `${base}/guests`, `${base}/schedule`]) {
        await open(page, path);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        assert(sw <= width, `${path} overflows at ${width}px (scrollWidth ${sw})`);
      }
      await ctx.close();
    }
  });
} finally {
  await browser.close();
}
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
