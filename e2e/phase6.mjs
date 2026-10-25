// Browser checks for phase 6: readiness, printable summary (print emulation, screenshots, PDF text), public read-only demo,
// venue management, the layout planner (keyboard, numeric, drag, bounds, save), sample event load/reset, settings,
// privacy and account/workspace deletion. One isolated browser context per role.
//
// Needs: dev server on :3000, the disposable accounts (npm run dev:users -- create), and the dev project's env file:
//   $env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e:p6
// Steps marked "needs 006" use migration 20261026000006; set E2E_NO006=1 to skip them while it is not applied.
// Screenshots and the PDF are written to E2E_SHOTS (default: <temp>/sceneset-shots) so a person can look at them.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.DEV_USERS_PASSWORD;
const NO006 = process.env.E2E_NO006 === "1";
const SHOTS = process.env.E2E_SHOTS ?? join(tmpdir(), "sceneset-shots");
mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) {
  console.error("Set DEV_USERS_PASSWORD to the password printed by `npm run dev:users -- create`.");
  process.exit(2);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = (r) => `dev-${r}@example.test`;
const browser = await chromium.launch();
const results = [];
const step = async (name, fn, opts = {}) => {
  if (process.env.E2E_ONLY && !name.startsWith("setup") && !process.env.E2E_ONLY.split("|").some((s) => name.includes(s))) return; // e.g. E2E_ONLY="rich event|screenshots for review"
  if (opts.needs006 && NO006) {
    results.push([name, "skip"]);
    console.log(`SKIP ${name} (needs migration 006)`);
    return;
  }
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
};
const signIn = async (page, role, next) => {
  await open(page, next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email(role));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !["/login", "/app"].includes(u.pathname));
  await page.waitForLoadState("networkidle");
};
const submit = async (page, locator) => {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), locator.click()]);
  await page.waitForLoadState("networkidle");
};
const text = async (loc) => (await loc.innerText()).replace(/\s+/g, " ");
const notFound = async (page, path) => {
  await open(page, path);
  await page.getByText("Page not found").waitFor();
};
const must = async (q) => {
  const r = await q;
  if (r.error) throw new Error(`seed failed: ${r.error.message}`);
  return r.data;
};

const A = { owner: await newPage(), organiser: await newPage(), collab: await newPage(), outsider: await newPage() };
const owner = A.owner.page;
let ws, uid;
const HK = "Asia/Hong_Kong";

// ------------------------------------------------------------------ seeding (service key: bypasses RLS, fast, test records only)
const evBase = (title, extra = {}) => ({
  workspace_id: ws, title, starts_at: "2026-11-14T07:00:00Z", ends_at: "2026-11-14T17:00:00Z", timezone: HK, currency: "HKD", created_by: uid.owner, ...extra,
});
const seedEvent = async (title, extra) => (await must(admin.from("events").insert(evBase(title, extra)).select("id").single())).id;
const seedVenue = async (name, w, d) => (await must(admin.from("venues").insert({ workspace_id: ws, name, width_cm: w, depth_cm: d }).select("id").single())).id;
const url = (ev, tail = "") => `/w/${ws}/events/${ev}${tail}`;
const readiness = async (page) => {
  const pct = Number(await page.locator("[data-readiness]").first().getAttribute("data-readiness"));
  const checks = await page.locator("[data-check]").evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute("data-check"), e.getAttribute("data-done") === "true"])));
  return { pct, checks, text: await text(page.locator("section[aria-labelledby=d-ready]")) };
};

try {
  // ================================================================== setup
  await step("setup: workspace with an organiser and a collaborator; user ids", async () => {
    await signIn(owner, "owner");
    await owner.getByLabel("Workspace name").fill("P6 Layout Co");
    await owner.getByRole("button", { name: "Create workspace" }).click();
    await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    ws = /\/w\/([0-9a-f-]{36})\//.exec(owner.url())[1];
    // This suite seeds many events in one workspace; the plan limits are tested in phase7.mjs (seeding bypasses RLS but not the limit trigger).
    await must(admin.from("workspaces").update({ plan: "organiser" }).eq("id", ws).select("id"));
    await open(owner, `/w/${ws}/settings`);
    for (const [mail, role] of [[email("organiser"), "organiser"], [email("collaborator"), "collaborator"]]) {
      const form = owner.locator("form:has(input[name=email])");
      await form.getByLabel("Add a member by email").fill(mail);
      await form.getByLabel("Role").selectOption(role);
      await submit(owner, form.getByRole("button", { name: "Add member" }));
      await owner.getByText("Member added.").waitFor();
    }
    const users = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users;
    const id = (r) => users.find((u) => u.email === email(r)).id;
    uid = { owner: id("owner"), organiser: id("organiser"), collab: id("collaborator"), outsider: id("outsider") };
  });

  // ================================================================== readiness (P6.8, P6.9)
  let ready1;
  await step("readiness: an empty event is 0 of 11 (0%), nothing passes, every item links to the view that fixes it", async () => {
    ready1 = await seedEvent("Ready Lab", { venue_id: null });
    await open(owner, url(ready1));
    const r = await readiness(owner);
    assert(r.pct === 0 && /0 of 11 checks passed \(0%\)/.test(r.text), r.text);
    assert(Object.values(r.checks).length === 11 && Object.values(r.checks).every((v) => v === false), "an empty plan must pass nothing");
    assert(/not a safety, legal or compliance certification/.test(r.text), "the planning-aid disclaimer is missing");
    assert(/percentage is checks passed divided by 11/.test(r.text), "the calculation is not explained");
    const hrefs = await owner.locator("[data-check] a").evaluateAll((as) => as.map((a) => [a.closest("[data-check]").getAttribute("data-check"), new URL(a.href).pathname.replace(/^.*\/events\/[0-9a-f-]{36}/, "")]));
    const want = { venue: "/layout", "budget-setup": "/edit", "within-budget": "/budget", tasks: "/tasks", overdue: "/tasks", quotes: "/suppliers", guests: "/guests", capacity: "/edit", "run-of-show": "/schedule", clashes: "/schedule", layout: "/layout" };
    assert(JSON.stringify(Object.fromEntries(hrefs)) === JSON.stringify(want), `links: ${JSON.stringify(hrefs)}`);
    await owner.locator('[data-check="guests"] a').click();
    await owner.waitForURL(/\/guests$/);
    await open(owner, url(ready1));
    await owner.locator('[data-check="venue"] a').click();
    await owner.waitForURL(/\/layout$/);
  });
  await step("readiness follows the saved records: 8 of 11 (73%), then each fix moves it, 100% only when all 11 pass, and over capacity or over budget take it back down", async () => {
    const v = await seedVenue("Ready Hall", 1000, 800);
    await must(admin.from("events").update({ venue_id: v, capacity: 50, budget_target_minor: 1_000_000 }).eq("id", ready1).select("id"));
    const sup = (await must(admin.from("suppliers").insert({ workspace_id: ws, name: "Ready Supplier", category: "Decor" }).select("id").single())).id;
    const q = (await must(admin.from("quotes").insert({ workspace_id: ws, event_id: ready1, supplier_id: sup, amount_minor: 1000, status: "requested" }).select("id").single())).id;
    await must(admin.from("budget_items").insert({ workspace_id: ws, event_id: ready1, category: "Decor", name: "Banners", planned_minor: 300000, committed_minor: 300000 }).select("id"));
    const late = (await must(admin.from("tasks").insert([{ workspace_id: ws, event_id: ready1, title: "Late task", due_on: "2020-01-01", created_by: uid.owner }, { workspace_id: ws, event_id: ready1, title: "Later task", due_on: "2099-01-01", created_by: uid.owner }]).select("id")))[0].id;
    const guest = (await must(admin.from("guests").insert({ workspace_id: ws, event_id: ready1, name: "Party", party_size: 5, rsvp: "confirmed" }).select("id").single())).id;
    await must(admin.from("schedule_entries").insert({ workspace_id: ws, event_id: ready1, title: "Doors", starts_at: "2026-11-14T08:00:00Z", ends_at: "2026-11-14T09:00:00Z" }).select("id"));
    await open(owner, url(ready1));
    let r = await readiness(owner);
    const fails = (c) => Object.entries(c).filter(([, d]) => !d).map(([k]) => k).sort().join();
    assert(r.pct === 73 && /8 of 11 checks passed \(73%\)/.test(r.text) && fails(r.checks) === "layout,overdue,quotes", `stage 1: ${r.pct}% fails ${fails(r.checks)}`);
    await must(admin.from("tasks").update({ status: "done" }).eq("id", late).select("id"));
    await must(admin.from("quotes").update({ status: "rejected" }).eq("id", q).select("id"));
    await open(owner, url(ready1));
    r = await readiness(owner);
    assert(r.pct === 91 && fails(r.checks) === "layout", `stage 2: ${r.pct}% fails ${fails(r.checks)}`);
    await must(admin.from("layout_items").insert({ workspace_id: ws, event_id: ready1, kind: "table", label: "T1", x_cm: 0, y_cm: 0, w_cm: 100, h_cm: 100 }).select("id"));
    await open(owner, url(ready1));
    r = await readiness(owner);
    assert(r.pct === 100 && /11 of 11 checks passed \(100%\)/.test(r.text), `stage 3: ${r.pct}%`);
    // the table caps one party at 50 people, so push attendance over the capacity of 50 with a second confirmed party
    await must(admin.from("guests").update({ party_size: 50 }).eq("id", guest).select("id"));
    await must(admin.from("guests").insert({ workspace_id: ws, event_id: ready1, name: "Extra party", party_size: 5, rsvp: "confirmed" }).select("id"));
    await open(owner, url(ready1));
    r = await readiness(owner);
    assert(r.pct === 91 && fails(r.checks) === "capacity" && /above capacity/.test(r.text), `stage 4: ${r.pct}% fails ${fails(r.checks)}`);
    await must(admin.from("budget_items").update({ committed_minor: 1_200_000 }).eq("event_id", ready1).select("id"));
    await open(owner, url(ready1));
    r = await readiness(owner);
    assert(r.pct === 82 && fails(r.checks) === "capacity,within-budget", `stage 5: ${r.pct}% fails ${fails(r.checks)}`);
    // the dashboard percentage and the printable summary agree
    await open(owner, url(ready1, "/summary"));
    assert((await readiness(owner)).pct === 82, "summary readiness differs from the dashboard");
  });

  // ================================================================== printable summary (P6.10, P6.11)
  let gala;
  await step("print summary: a rich event renders every section on screen", async () => {
    const v = await seedVenue("Gala Courtyard with a Rather Long Venue Name", 2000, 1500);
    gala = await seedEvent("Print Gala: the long-named end-of-year showcase and market night", {
      venue_id: v, capacity: 100, budget_target_minor: 5_000_000, goals: "A deliberately long goal statement to check that wrapping works and nothing is cut off in the printed plan. ".repeat(2),
      starts_at: "2026-11-14T07:00:00Z", ends_at: "2026-11-14T17:00:00Z",
    });
    const long = "Confirm the stage supplier and the power plan for the north-east corner of the courtyard including generator hire";
    await must(admin.from("tasks").insert(Array.from({ length: 14 }, (_, i) => ({ workspace_id: ws, event_id: gala, title: i % 3 === 0 ? `${long} ${i + 1}` : `Task ${i + 1}`, status: ["todo", "in_progress", "done"][i % 3], priority: ["low", "medium", "high"][i % 3], due_on: i % 4 === 0 ? "2020-02-01" : "2026-11-01", assignee_id: i % 2 ? uid.collab : uid.organiser, created_by: uid.owner }))).select("id"));
    const sups = await must(admin.from("suppliers").insert(Array.from({ length: 4 }, (_, i) => ({ workspace_id: ws, name: `Supplier number ${i + 1} with a rather long trading name Ltd`, category: ["Decor", "Catering", "Sound & lighting", "Staffing"][i] }))).select("id"));
    await must(admin.from("quotes").insert(sups.flatMap((s, i) => [{ workspace_id: ws, event_id: gala, supplier_id: s.id, amount_minor: 123456 + i * 1000, scope: "Full service including delivery, set-up and collection afterwards", status: "shortlisted" }])).select("id"));
    await must(admin.from("budget_items").insert(Array.from({ length: 9 }, (_, i) => ({ workspace_id: ws, event_id: gala, category: ["Decor", "Venue", "Catering"][i % 3], name: `Budget line ${i + 1} with a longer descriptive name`, planned_minor: 100000 * (i + 1) + 5, committed_minor: 90000 * (i + 1), paid_minor: 10000 * i }))).select("id"));
    await must(admin.from("guests").insert(Array.from({ length: 24 }, (_, i) => ({ workspace_id: ws, event_id: gala, name: `Guest party ${i + 1} (a name long enough to wrap in a narrow column)`, group_name: ["Friends and family of the organisers", "Vendors", "Press"][i % 3], party_size: 1 + (i % 5), rsvp: ["confirmed", "tentative", "invited", "declined"][i % 4], contact: `private${i}@example.test` }))).select("id"));
    const base = Date.parse("2026-11-14T07:00:00Z");
    await must(admin.from("schedule_entries").insert(Array.from({ length: 14 }, (_, i) => ({ workspace_id: ws, event_id: gala, title: `Activity ${i + 1}: ${i === 13 ? "Pack-down running past midnight" : "a fairly long running order description"}`, starts_at: new Date(base + i * 40 * 60000).toISOString(), ends_at: new Date(base + (i * 40 + (i === 13 ? 180 : 75)) * 60000).toISOString(), location: "Courtyard north side", owner_id: i % 4 === 0 ? uid.organiser : null }))).select("id"));
    await must(admin.from("layout_items").insert(Array.from({ length: 14 }, (_, i) => ({ workspace_id: ws, event_id: gala, kind: ["table", "booth", "stage", "entrance", "other"][i % 5], label: i % 5 === 2 ? "Main stage with an extremely long label" : `Obj ${i + 1}`, x_cm: 100 + (i % 7) * 250, y_cm: 100 + Math.floor(i / 7) * 600, w_cm: 200, h_cm: 150 }))).select("id"));
    await open(owner, url(gala, "/summary"));
    const t = await text(owner.locator("main"));
    for (const h of ["Tasks and responsibilities", "Budget", "Suppliers and quotes", "Guests and headcount", "Running order", "Venue layout", "Readiness"]) assert(t.includes(h), `section missing: ${h}`);
    assert(/Attending headcount: \d+ of 100 capacity/.test(t), "headcount line missing");
    assert(!/private\d+@example\.test/.test(t), "guest contact details must not be printed");
    assert(await owner.getByRole("button", { name: "Print this summary" }).isVisible(), "no print button on screen");
  });
  await step("print summary: in print mode navigation and controls are gone and nothing is clipped (A4 width, screenshots, PDF text)", async () => {
    const state = await owner.context().storageState();
    const { ctx, page } = await newPage({ viewport: { width: 794, height: 1123 }, storageState: state });
    await open(page, url(gala, "/summary"));
    await page.emulateMedia({ media: "print" });
    const rep = await page.evaluate(() => {
      const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
      const vw = document.documentElement.clientWidth;
      return {
        wide: [...document.querySelectorAll("body *")].filter((e) => vis(e) && e.getBoundingClientRect().right > vw + 1).map((e) => `${e.tagName}.${String(e.className).slice(0, 30)} right=${Math.round(e.getBoundingClientRect().right)}`).slice(0, 6),
        scrolling: [...document.querySelectorAll("*")].filter((e) => vis(e) && ["auto", "scroll"].includes(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 1).map((e) => e.tagName).slice(0, 6),
        chrome: [...document.querySelectorAll("aside, nav, button, form, input, select, textarea")].filter(vis).map((e) => `${e.tagName}:${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 25)}`),
        bodyBg: getComputedStyle(document.body).backgroundColor,
        pageW: document.documentElement.scrollWidth,
      };
    });
    assert(rep.wide.length === 0, `content wider than the page: ${rep.wide.join("; ")}`);
    assert(rep.scrolling.length === 0, `scroll containers still active in print: ${rep.scrolling}`);
    assert(rep.chrome.length === 0, `navigation or controls visible in print: ${rep.chrome.join(", ")}`);
    assert(rep.bodyBg === "rgb(255, 255, 255)" && rep.pageW <= 795, `background ${rep.bodyBg}, width ${rep.pageW}`);
    await page.screenshot({ path: join(SHOTS, "summary-print-a4.png"), fullPage: true });
    const pdf = join(SHOTS, "summary.pdf");
    writeFileSync(pdf, await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
    const txt = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
    const pages = txt.split("\f").filter((p) => p.trim()).length;
    for (const s of ["Print Gala", "Tasks and responsibilities", "Guests and headcount", "Running order", "Venue layout", "Obj 14", "Activity 14", "Guest party 24", "Budget line 9", "Supplier number 4", "Readiness is a planning aid"]) assert(txt.includes(s) || txt.replace(/\s+/g, " ").includes(s), `PDF text is missing "${s}"`);
    assert(!/Print this summary|Sign out|Dashboard\s+Tasks and notes/.test(txt), "navigation text leaked into the PDF");
    assert(!/private\d+@example/.test(txt), "contact details in the PDF");
    assert(pages >= 2 && pages <= 8, `unexpected page count: ${pages}`);
    writeFileSync(join(SHOTS, "summary-pdf-pages.txt"), `pages: ${pages}\n`);
    await ctx.close();
  });
  await step("print summary: authorised members can open it; other workspaces and bad ids get 'Page not found'", async () => {
    const c = A.collab.page;
    await signIn(c, "collaborator", url(gala, "/summary"));
    await c.getByText("Tasks and responsibilities").first().waitFor();
    const o = A.outsider.page;
    await signIn(o, "outsider");
    await o.getByLabel("Workspace name").fill("Outsider Co");
    await o.getByRole("button", { name: "Create workspace" }).click();
    await o.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    await notFound(o, url(gala, "/summary"));
    await notFound(o, url(gala, "/layout"));
    await notFound(o, `/w/${ws}/events/not-a-uuid/summary`);
    const anon = await newPage();
    await open(anon.page, url(gala, "/summary"));
    assert(new URL(anon.page.url()).pathname === "/login", "anonymous visitors must be sent to login");
    await anon.ctx.close();
  });
  await step("screenshots for review: the summary and the dashboard at 375 and 1440 px, without page-level horizontal overflow", async () => {
    const state = await owner.context().storageState();
    for (const [w, h] of [[375, 800], [768, 1000], [1024, 800], [1440, 900]]) {
      const { ctx, page } = await newPage({ viewport: { width: w, height: h }, storageState: state });
      for (const [name, path] of [["dashboard", url(gala)], ["summary", url(gala, "/summary")], ["layout", url(gala, "/layout")]]) {
        await open(page, path);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        const wide = sw <= w ? [] : await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).display !== "none").map((e) => [e, e.getBoundingClientRect().right, e.scrollWidth]).sort((a, b) => Math.max(b[1], b[2]) - Math.max(a[1], a[2])).slice(0, 5).map(([e, r, s]) => `${e.tagName}.${String(e.className).slice(0, 60)} right=${Math.round(r)} scrollW=${s}`));
        assert(sw <= w, `${name} overflows at ${w}px (scrollWidth ${sw}): ${wide.join(" | ")}`);
        if (w === 375 || w === 1440) await page.screenshot({ path: join(SHOTS, `${name}-${w}.png`), fullPage: true });
      }
      await ctx.close();
    }
  });

  // ================================================================== public read-only demo (P6.13)
  await step("public demo: no sign-in, fictional, read-only, same rules as the app (readiness 9 of 11, committed HKD 21,700.50)", async () => {
    const anon = await newPage();
    const p = anon.page;
    await open(p, "/demo");
    const t = await text(p.locator("main"));
    assert(/9 of 11 checks passed \(82%\)/.test(t), `demo readiness: ${t.slice(0, 300)}`);
    assert(/Committed HKD 21,700\.50/.test(t) && /58 people attending \(confirmed\) of 150 capacity/.test(t), "demo budget or headcount differs from the sample");
    assert(/Harbour Night Market \(sample\)/.test(await text(p.locator("body"))), "sample title missing");
    assert(/Read-only demo/.test(await text(p.locator("body"))), "no read-only banner");
    for (const v of ["tasks", "budget", "suppliers", "guests", "schedule", "layout", "summary"]) {
      await open(p, `/demo/${v}`);
      assert((await p.locator("main form, main input, main textarea, main select").count()) === 0, `/demo/${v} contains a form control`);
      assert((await p.locator("main button:not([aria-label]), main [type=submit]").filter({ hasText: /Save|Add|Delete|Accept|Mark|Remove|Reset|Load/ }).count()) === 0, `/demo/${v} has an action button`);
    }
    await open(p, "/demo/layout");
    await p.locator('svg[aria-label^="Sample layout"]').waitFor();
    await open(p, "/demo/summary");
    const s = await text(p.locator("main"));
    assert(/Sample party A/.test(s) && /Stallholder load-in/.test(s) && /Stall 6/.test(s), "summary sections missing");
    await notFound(p, "/demo/bogus");
    await open(p, `/w/${ws}/events`);
    assert(new URL(p.url()).pathname === "/login", "workspace pages must still need sign-in");
    await anon.ctx.close();
  });

  // ================================================================== settings, privacy, workspace deletion (P6.14 - P6.16)
  await step("privacy page: plain-language, covers collection, purpose, visibility, cookies, retention and deletion; sign-up shows its notice", async () => {
    const anon = await newPage();
    await open(anon.page, "/privacy");
    const t = await text(anon.page.locator("main"));
    for (const k of ["What is collected", "Why", "Who can see it", "Cookies and tracking", "How long it is kept", "Deleting your data", "Your choices", "Contact", "not</strong> been legally reviewed|has not been legally reviewed"]) assert(new RegExp(k, "i").test(t) || t.includes(k.split("|")[0]), `privacy page lacks: ${k}`);
    assert(/only essential session cookies/i.test(t) && /no analytics or advertising cookies/i.test(t), "cookie statement missing");
    assert(!/Interim notice/.test(t), "interim notice still present");
    await open(anon.page, "/signup");
    assert(/We store your name and email/.test(await text(anon.page.locator("main"))), "no collection notice at sign-up");
    await anon.ctx.close();
  });
  await step("settings: the name saves and persists; the delete controls explain what is removed", async () => {
    await open(owner, `/w/${ws}/settings`);
    await owner.getByLabel("Your name").fill("Dev owner renamed");
    await submit(owner, owner.getByRole("button", { name: "Save name" }));
    await owner.getByText("Your name was saved.").waitFor();
    await owner.reload();
    assert((await owner.getByLabel("Your name").inputValue()) === "Dev owner renamed", "name not saved");
    await owner.getByLabel("Your name").fill("Dev owner");
    await submit(owner, owner.getByRole("button", { name: "Save name" }));
    const t = await text(owner.locator("main"));
    assert(/Former member/.test(t) && /Permanently deletes the workspace/.test(t), "deletion consequences are not explained");
    assert((await owner.getByRole("link", { name: "privacy notice" }).count()) > 0, "no link to the privacy notice");
  });
  await step("delete workspace: needs the exact name; a wrong name deletes nothing; the right name deletes it for everyone", async () => {
    await open(owner, "/onboarding");
    await owner.getByLabel("Workspace name").fill("Delete Me Co");
    await owner.getByRole("button", { name: "Create workspace" }).click();
    await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    const doomed = /\/w\/([0-9a-f-]{36})\//.exec(owner.url())[1];
    await open(owner, `/w/${doomed}/settings`);
    const form = owner.getByRole("form", { name: "Delete this workspace" });
    await form.getByLabel(/Type the workspace name/).fill("delete me");
    await submit(owner, form.getByRole("button", { name: "Delete workspace" }));
    await owner.getByText("What you typed does not match, so nothing was deleted.").waitFor();
    assert(((await admin.from("workspaces").select("id").eq("id", doomed)).data ?? []).length === 1, "workspace was deleted by a wrong confirmation");
    await owner.getByRole("form", { name: "Delete this workspace" }).getByLabel(/Type the workspace name/).fill("Delete Me Co");
    await submit(owner, owner.getByRole("form", { name: "Delete this workspace" }).getByRole("button", { name: "Delete workspace" }));
    await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/); // /app sends you to your remaining workspace
    assert(((await admin.from("workspaces").select("id").eq("id", doomed)).data ?? []).length === 0, "workspace still exists");
    assert(owner.url().includes(ws), "owner should land back in the remaining workspace");
  });
  await step("delete account is blocked for a sole owner whose workspace has other members, and nothing changes", async () => {
    await open(owner, `/w/${ws}/settings`);
    // the blockers list needs migration 006; without it the page cannot know, so this step needs it
    await owner.getByText(/Deletion is blocked until you hand over/).waitFor();
    const form = owner.getByRole("form", { name: "Delete your account" });
    await form.getByLabel(/Type your email address/).fill(email("owner"));
    await submit(owner, form.getByRole("button", { name: "Delete my account" }));
    await owner.getByText(/only owner of a workspace that other people use/).waitFor();
    const u = (await admin.auth.admin.getUserById(uid.owner)).data.user;
    assert(u && ((await admin.from("workspaces").select("id").eq("id", ws)).data ?? []).length === 1, "the account or workspace was removed despite the block");
  }, { needs006: true });

  // ================================================================== venues and the layout planner (P6.1 - P6.7)
  let lab, venueId;
  await step("venues: add, edit (persists), stale edit refused, and the venue can be chosen for an event", async () => {
    lab = await seedEvent("Layout Lab", { venue_id: null });
    await open(owner, url(lab, "/layout"));
    await owner.getByText("No venue is set for this event").waitFor();
    const add = owner.locator("section[aria-labelledby=venues-h] div:has(> h3:text-is('Add a venue'))");
    await add.getByLabel("Venue name").fill("Annex Hall");
    await add.getByLabel("Width (m)").fill("12");
    await add.getByLabel("Depth (m)").fill("8");
    await submit(owner, add.getByRole("button", { name: "Add venue" }));
    await owner.getByText("Venue added.").waitFor();
    const row = owner.locator('[data-venue="Annex Hall"]');
    assert(/12 m by 8 m/.test(await text(row)), "size not shown in metres");
    await row.getByText("Edit venue").click();
    await row.getByLabel("Venue name").fill("Annex Hall North");
    await row.getByLabel("Width (m)").fill("12.5");
    await submit(owner, row.getByRole("button", { name: "Save venue" }));
    await owner.getByText("Venue saved.").waitFor();
    assert(/12\.50 m by 8 m|12\.5 m by 8 m/.test(await text(owner.locator('[data-venue="Annex Hall North"]'))), "edit not saved");
    // stale edit
    const a = await owner.context().newPage();
    const b = await owner.context().newPage();
    for (const p of [a, b]) { await open(p, url(lab, "/layout")); await p.locator('[data-venue="Annex Hall North"]').getByText("Edit venue").click(); }
    await a.locator('[data-venue="Annex Hall North"]').getByLabel("Venue name").fill("Annex A");
    await submit(a, a.locator('[data-venue="Annex Hall North"]').getByRole("button", { name: "Save venue" }));
    await a.getByText("Venue saved.").waitFor();
    await b.locator('[data-venue="Annex Hall North"]').getByLabel("Venue name").fill("Stale B");
    await b.locator('[data-venue="Annex Hall North"]').getByRole("button", { name: "Save venue" }).click();
    await b.getByText("changed by someone else").waitFor();
    await a.close(); await b.close();
    // invalid size keeps typed values
    await open(owner, url(lab, "/layout"));
    const r2 = owner.locator('[data-venue="Annex A"]');
    await r2.getByText("Edit venue").click();
    await r2.getByLabel("Width (m)").fill("-3");
    await r2.getByLabel("Venue name").fill("Keep this typed name");
    await submit(owner, r2.getByRole("button", { name: "Save venue" }));
    await r2.getByText(/enter metres from 1 to 1000/).first().waitFor();
    assert((await r2.getByLabel("Venue name").inputValue()) === "Keep this typed name", "typed name lost");
    venueId = (await must(admin.from("venues").select("id").eq("name", "Annex A").single())).id;
  });
  await step("venues: choosing a venue attaches it; deleting it keeps the event (no venue) and never deletes an event", async () => {
    await open(owner, url(lab, "/layout"));
    await owner.getByLabel("Choose a venue").selectOption(venueId);
    await submit(owner, owner.getByRole("button", { name: "Use this venue" }));
    await owner.getByText("Venue updated for this event.").waitFor();
    assert(/1 event\b/.test(await text(owner.locator('[data-venue="Annex A"]'))), "usage count missing");
    await owner.locator('[data-venue="Annex A"]').getByRole("button", { name: "Delete" }).click();
    const dlg = await text(owner.getByRole("dialog"));
    assert(/used by 1 event/.test(dlg) && /keep all their data/.test(dlg), `delete warning: ${dlg}`);
    await owner.getByRole("dialog").getByRole("button", { name: "Delete venue" }).click();
    await owner.getByText(/Venue deleted\. Events that used it were kept/).waitFor();
    assert(((await admin.from("events").select("id,venue_id").eq("id", lab)).data ?? [])[0]?.venue_id === null, "the event lost more than its venue");
    await owner.getByText("No venue is set for this event").waitFor();
  });
  await step("planner setup: a 10 m by 8 m venue with a table and a stage, opened in the planner", async () => {
    const v = await seedVenue("Planner Hall", 1000, 800);
    await admin.from("events").update({ venue_id: v }).eq("id", lab);
    await must(admin.from("layout_items").insert([
      { workspace_id: ws, event_id: lab, kind: "table", label: "Table 1", x_cm: 100, y_cm: 100, w_cm: 150, h_cm: 150 },
      { workspace_id: ws, event_id: lab, kind: "stage", label: "Stage", x_cm: 600, y_cm: 50, w_cm: 300, h_cm: 200 },
    ]).select("id"));
    await open(owner, url(lab, "/layout"));
    await owner.locator('[data-object="Table 1"]').waitFor();
    assert((await owner.locator("svg [role=button]").count()) === 2, "both objects should be in the plan");
    assert((await owner.locator('[data-object="Table 1"]').getAttribute("tabindex")) === "0", "objects must be keyboard focusable");
    await owner.screenshot({ path: join(SHOTS, "layout-planner-1440.png"), fullPage: true });
  });
  const row = (label) => owner.locator(`[data-row="${label}"]`);
  const nums = async (label) => (await row(label).locator("td.num").allInnerTexts()).slice(0, 4).map(Number);
  await step("planner keyboard: arrows move 0.1 m, Shift moves 1 m, Ctrl+arrows resize, edges stop movement, changes are unsaved until Save", async () => {
    const obj = owner.locator('[data-object="Table 1"]');
    await obj.focus();
    await owner.keyboard.press("ArrowRight");
    assert((await nums("Table 1"))[0] === 1.1, `x after ArrowRight: ${await nums("Table 1")}`);
    await owner.keyboard.press("Shift+ArrowDown");
    assert((await nums("Table 1"))[1] === 2, `y after Shift+ArrowDown: ${await nums("Table 1")}`);
    await owner.keyboard.press("Control+ArrowRight");
    assert((await nums("Table 1"))[2] === 1.6, `width after Ctrl+ArrowRight: ${await nums("Table 1")}`);
    await owner.getByText("You have unsaved changes.").waitFor();
    assert((await owner.locator("[data-live]").innerText()).includes("Table 1"), "no live-region announcement");
    const stage = owner.locator('[data-object="Stage"]');
    await stage.focus();
    for (let i = 0; i < 12; i++) await owner.keyboard.press("Shift+ArrowRight");
    assert((await nums("Stage"))[0] === 7, `Stage should stop at the right edge (x 7 m): ${await nums("Stage")}`);
    assert((await owner.locator("[data-live]").innerText()).includes("edge of the venue"), "edge not announced");
    for (let i = 0; i < 12; i++) await owner.keyboard.press("Shift+ArrowUp");
    assert((await nums("Stage"))[1] === 0, "Stage should stop at the top edge");
    for (let i = 0; i < 12; i++) await owner.keyboard.press("Control+Shift+ArrowRight");
    const [x, , w] = await nums("Stage");
    assert(x + w <= 10 + 1e-9, `Stage grew past the venue: x ${x} + w ${w}`);
    await owner.screenshot({ path: join(SHOTS, "layout-planner-keyboard.png"), fullPage: true });
  });
  await step("planner numeric form: out-of-bounds and bad numbers are explained and not applied; valid values apply; labels and kinds edit", async () => {
    await row("Table 1").getByRole("button", { name: "Select Table 1" }).click();
    const f = owner.getByRole("form", { name: "Exact position and size" });
    const before = await nums("Table 1");
    await f.getByLabel(/X, from left/).fill("9.5");
    await f.getByRole("button", { name: "Apply" }).click();
    await f.getByText(/reaches .* m across; the venue is 10\.00 m wide/).waitFor();
    assert(JSON.stringify(await nums("Table 1")) === JSON.stringify(before), "an out-of-bounds value was applied");
    await f.getByLabel(/X, from left/).fill("-1");
    await f.getByRole("button", { name: "Apply" }).click();
    await f.getByText(/Enter each position and size in metres/).waitFor();
    await f.getByLabel(/X, from left/).fill("2.5");
    await f.getByLabel("Label").fill("Head table");
    await f.getByRole("button", { name: "Apply" }).click();
    await owner.locator('[data-row="Head table"]').waitFor();
    assert((await nums("Head table"))[0] === 2.5, "valid number not applied");
  });
  await step("planner add, remove and revert: new objects start inside the venue; Revert restores the saved layout", async () => {
    const add = owner.getByRole("form", { name: "Add an object" });
    await add.getByLabel("Kind").selectOption("booth");
    await add.getByLabel("Label").fill("Booth Z");
    await add.getByRole("button", { name: "Add to the plan" }).click();
    const z = owner.locator('[data-row="Booth Z"]');
    await z.waitFor();
    assert(/new, unsaved/.test(await text(z)), "new object not marked unsaved");
    const [x, y, w, h] = await nums("Booth Z");
    assert(x >= 0 && y >= 0 && x + w <= 10 && y + h <= 8, `new object outside the venue: ${[x, y, w, h]}`);
    await owner.getByRole("button", { name: "Remove Stage" }).click();
    assert((await owner.locator('[data-row="Stage"]').count()) === 0, "Stage not removed from the draft");
    await owner.getByRole("button", { name: "Revert changes" }).click();
    await owner.getByText("All changes are saved.").waitFor();
    assert((await owner.locator('[data-row="Booth Z"]').count()) === 0 && (await owner.locator('[data-row="Stage"]').count()) === 1 && (await owner.locator('[data-row="Table 1"]').count()) === 1, "Revert did not restore the saved layout");
    assert((await nums("Table 1"))[0] === 1 && (await nums("Table 1"))[1] === 1, "Table 1 did not return to its saved position");
  });
  await step("planner pointer drag: dragging moves the object and cannot leave the venue; the numbers match", async () => {
    const svg = owner.locator("svg[role=group]");
    await svg.scrollIntoViewIfNeeded(); // mouse coordinates are viewport coordinates: the plan must be on screen
    const box = await svg.boundingBox();
    const obj = owner.locator('[data-object="Table 1"] rect').first();
    const ob = await obj.boundingBox();
    await owner.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2);
    await owner.mouse.down();
    await owner.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 6 });
    await owner.mouse.up();
    const [x, y] = await nums("Table 1");
    assert(x > 3 && x < 6 && y > 2 && y < 5, `drag to the middle should land mid-venue: ${[x, y]}`);
    const ob2 = await obj.boundingBox();
    await owner.mouse.move(ob2.x + ob2.width / 2, ob2.y + ob2.height / 2);
    await owner.mouse.down();
    const vp = owner.viewportSize();
    // drag far past the bottom-right corner of the venue (pointer capture keeps delivering moves outside the plan)
    await owner.mouse.move(Math.min(vp.width - 2, box.x + box.width + 300), Math.min(vp.height - 2, box.y + box.height + 300), { steps: 6 });
    await owner.mouse.up();
    const [x2, y2, w2, h2] = await nums("Table 1");
    assert(x2 + w2 <= 10 + 1e-9 && y2 + h2 <= 8 + 1e-9 && x2 >= 0 && y2 >= 0, `drag escaped the venue: ${[x2, y2, w2, h2]}`);
    assert(Math.abs(x2 + w2 - 10) < 0.02 && Math.abs(y2 + h2 - 8) < 0.02, "dragging far outside should stop at the corner");
    await owner.getByRole("button", { name: "Revert changes" }).click();
  });
  await step("layout page is usable at 375 px: no page-level overflow; the plan and the object list are reachable", async () => {
    const state = await owner.context().storageState();
    const { ctx, page } = await newPage({ viewport: { width: 375, height: 800 }, storageState: state });
    await open(page, url(lab, "/layout"));
    assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= 375, "page overflows at 375px");
    await page.locator("svg[role=group]").scrollIntoViewIfNeeded();
    const b = await page.locator("svg[role=group]").boundingBox();
    assert(b.width > 250 && b.width <= 375, `plan width at 375px: ${b.width}`);
    await page.screenshot({ path: join(SHOTS, "layout-planner-375.png"), fullPage: true });
    await ctx.close();
  });
  await step("collaborator sees the layout read-only (no planner, no save, no venue forms) with the same objects", async () => {
    const c = A.collab.page;
    await open(c, url(lab, "/layout"));
    await c.locator('svg[aria-label^="Layout of"]').waitFor();
    assert((await c.getByRole("button", { name: "Save layout" }).count()) === 0 && (await c.locator("svg [role=button]").count()) === 0, "planner controls visible");
    assert((await c.getByText("Add a venue").count()) === 0 && (await c.getByRole("button", { name: "Use this venue" }).count()) === 0, "venue forms visible");
    const t = await text(c.locator("main"));
    assert(/Table 1/.test(t) && /Stage/.test(t), "objects missing for the collaborator");
  });

  // ================================================================== needs migration 006
  await step("save and reload: the saved layout comes back with identical coordinates (needs 006)", async () => {
    await open(owner, url(lab, "/layout"));
    await owner.locator('[data-object="Table 1"]').focus();
    await owner.keyboard.press("Shift+ArrowRight");
    await owner.keyboard.press("ArrowDown");
    const add = owner.getByRole("form", { name: "Add an object" });
    await add.getByLabel("Kind").selectOption("entrance");
    await add.getByLabel("Label").fill("Gate");
    await add.getByRole("button", { name: "Add to the plan" }).click();
    const before = { table: await nums("Table 1"), stage: await nums("Stage"), gate: await nums("Gate") };
    await submit(owner, owner.getByRole("button", { name: "Save layout" }));
    await owner.getByText("Layout saved.").waitFor();
    await owner.reload();
    await owner.getByText("All changes are saved.").waitFor();
    assert(JSON.stringify([await nums("Table 1"), await nums("Stage"), await nums("Gate")]) === JSON.stringify([before.table, before.stage, before.gate]), "coordinates changed after reload");
    const db = (await admin.from("layout_items").select("label,x_cm,y_cm").eq("event_id", lab)).data;
    assert(db.find((r) => r.label === "Table 1").x_cm === Math.round(before.table[0] * 100) && db.length === 3, `database: ${JSON.stringify(db)}`);
    // saved objects are shown on the dashboard and the print summary too
    await open(owner, url(lab));
    assert(/3 objects placed in Planner Hall/.test(await text(owner.locator("section[aria-labelledby=d-layout]"))), "dashboard layout card is wrong");
  }, { needs006: true });
  await step("stale layout save: a second tab with old data is refused and none of its changes are saved (needs 006)", async () => {
    const a = await owner.context().newPage();
    const b = await owner.context().newPage();
    for (const p of [a, b]) await open(p, url(lab, "/layout"));
    await a.locator('[data-object="Stage"]').focus();
    await a.keyboard.press("ArrowLeft");
    await submit(a, a.getByRole("button", { name: "Save layout" }));
    await a.getByText("Layout saved.").waitFor();
    const add = b.getByRole("form", { name: "Add an object" });
    await add.getByLabel("Label").fill("Should not be saved");
    await add.getByRole("button", { name: "Add to the plan" }).click();
    await b.locator('[data-object="Stage"]').focus();
    await b.keyboard.press("ArrowDown");
    await b.getByRole("button", { name: "Save layout" }).click();
    await b.getByText(/changed by someone else/).waitFor();
    const db = (await admin.from("layout_items").select("label").eq("event_id", lab)).data.map((r) => r.label);
    assert(!db.includes("Should not be saved") && db.length === 3, `a failed save left data behind: ${db}`);
    await a.close(); await b.close();
  }, { needs006: true });
  await step("a venue cannot be made smaller than the objects on it, and an event cannot move to a venue its layout does not fit (needs 006)", async () => {
    await open(owner, url(lab, "/layout"));
    const r = owner.locator('[data-venue="Planner Hall"]');
    await r.getByText("Edit venue").click();
    await r.getByLabel("Width (m)").fill("5");
    await submit(owner, r.getByRole("button", { name: "Save venue" }));
    await r.getByText(/Some layout items would fall outside that size/).waitFor();
    const small = await seedVenue("Tiny Hall", 300, 300);
    await open(owner, url(lab, "/layout")); // the page was loaded before this venue existed
    await owner.getByLabel("Change venue").selectOption(small);
    await submit(owner, owner.getByRole("button", { name: "Use this venue" }));
    await owner.getByText(/layout objects do not fit in that venue/).waitFor();
    const ev = (await admin.from("events").select("venue_id").eq("id", lab).single()).data;
    assert(ev.venue_id !== small, "the event was moved to a venue it does not fit");
    assert((await admin.from("venues").select("width_cm").eq("name", "Planner Hall").single()).data.width_cm === 1000, "the venue was shrunk");
  }, { needs006: true });
  let sampleWs;
  await step("sample event: signed-in owner loads it into a new workspace; readiness 9 of 11 (82%); the numbers match the public demo (needs 006)", async () => {
    await open(owner, "/onboarding");
    await owner.getByLabel("Workspace name").fill("Sample Co");
    await owner.getByRole("button", { name: "Create workspace" }).click();
    await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    sampleWs = /\/w\/([0-9a-f-]{36})\//.exec(owner.url())[1];
    await owner.getByText("No events yet").waitFor();
    await submit(owner, owner.getByRole("button", { name: "Load a sample event" }));
    await owner.getByText(/Sample event loaded/).waitFor();
    const r = await readiness(owner);
    assert(r.pct === 82, `sample readiness ${r.pct}`);
    const t = await text(owner.locator("main"));
    assert(/Committed HKD 21,700\.50/.test(t) && /58 people attending \(confirmed\) of 150 capacity/.test(t), "sample numbers differ from the demo");
    const sampleEv = /\/events\/([0-9a-f-]{36})/.exec(owner.url())[1];
    const counts = await Promise.all(["tasks", "guests", "schedule_entries", "layout_items", "quotes", "budget_items"].map(async (tb) => (await admin.from(tb).select("id", { count: "exact", head: true }).eq("event_id", sampleEv)).count));
    assert(counts.join() === "8,12,8,11,5,5", `sample row counts: ${counts}`);
    await open(owner, `/w/${sampleWs}/events/${sampleEv}/layout`);
    assert((await owner.locator("svg [role=button]").count()) === 11, "the sample layout should open in the planner with 11 objects");
    await owner.screenshot({ path: join(SHOTS, "sample-layout.png"), fullPage: true });
  }, { needs006: true });
  await step("sample reset: replaces only the sample; the user's own event and another workspace are untouched; roles without rights see no button (needs 006)", async () => {
    await open(owner, `/w/${sampleWs}/events/new`);
    await owner.getByLabel("Event title").fill("My real event");
    await owner.getByLabel("Starts").fill("2026-12-01T10:00");
    await owner.getByLabel("Ends").fill("2026-12-01T12:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\?m=created$/);
    const mainBefore = (await admin.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", ws)).count;
    await open(owner, `/w/${sampleWs}/events`);
    const oldSample = (await admin.from("events").select("id").eq("workspace_id", sampleWs).eq("demo", true)).data[0].id;
    await owner.getByRole("button", { name: "Reset sample event" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Reset sample event" }).click();
    await owner.getByText(/Sample event loaded/).waitFor();
    const evs = (await admin.from("events").select("id,title,demo").eq("workspace_id", sampleWs)).data;
    assert(evs.length === 2 && evs.filter((e) => e.demo).length === 1 && evs.some((e) => e.title === "My real event"), `events after reset: ${JSON.stringify(evs)}`);
    assert(!evs.some((e) => e.id === oldSample), "the old sample event still exists");
    assert((await admin.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", ws)).count === mainBefore, "another workspace was affected");
    const c = A.collab.page;
    await open(c, `/w/${ws}/events`);
    assert((await c.getByRole("button", { name: "Load a sample event" }).count()) === 0 && (await c.getByRole("button", { name: "Reset sample event" }).count()) === 0, "a collaborator can see sample controls");
  }, { needs006: true });
  await step("delete account: a member who is not the sole owner can delete; shared records stay, authorship is cleared; the account cannot sign in again (needs 006)", async () => {
    const o = A.organiser.page;
    await signIn(o, "organiser", `/w/${ws}/settings`);
    const note = (await must(admin.from("notes").insert({ workspace_id: ws, event_id: lab, body: "Written by the organiser", author_id: uid.organiser }).select("id").single())).id;
    await open(o, `/w/${ws}/settings`);
    const form = o.getByRole("form", { name: "Delete your account" });
    await form.getByLabel(/Type your email address/).fill("someone-else@example.test");
    await submit(o, form.getByRole("button", { name: "Delete my account" }));
    await o.getByText("What you typed does not match, so nothing was deleted.").waitFor();
    assert((await admin.auth.admin.getUserById(uid.organiser)).data.user, "deleted despite a wrong confirmation");
    await o.getByRole("form", { name: "Delete your account" }).getByLabel(/Type your email address/).fill(email("organiser"));
    await Promise.all([o.waitForURL((u) => u.pathname === "/"), o.getByRole("form", { name: "Delete your account" }).getByRole("button", { name: "Delete my account" }).click()]);
    assert(!(await admin.auth.admin.getUserById(uid.organiser)).data.user, "the account still exists");
    assert(((await admin.from("profiles").select("id").eq("id", uid.organiser)).data ?? []).length === 0, "profile still exists");
    assert(((await admin.from("workspace_members").select("user_id").eq("user_id", uid.organiser)).data ?? []).length === 0, "memberships remain");
    assert(((await admin.from("workspaces").select("id").eq("id", ws)).data ?? []).length === 1, "the shared workspace was deleted");
    assert((await admin.from("notes").select("author_id").eq("id", note).single()).data.author_id === null, "authorship not cleared");
    const again = await newPage();
    await open(again.page, "/login");
    await again.page.getByLabel("Email").fill(email("organiser"));
    await again.page.getByLabel("Password").fill(PASSWORD);
    await again.page.getByRole("button", { name: "Sign in" }).click();
    await again.page.getByText("do not match an account").waitFor();
    await again.ctx.close();
  }, { needs006: true });
  await step("delete account: a user who is the only member of their workspace is deleted with it (needs 006)", async () => {
    const o = A.outsider.page;
    await open(o, "/app");
    const w = /\/w\/([0-9a-f-]{36})\//.exec(o.url())[1];
    await open(o, `/w/${w}/settings`);
    const form = o.getByRole("form", { name: "Delete your account" });
    await form.getByLabel(/Type your email address/).fill(email("outsider"));
    await Promise.all([o.waitForURL((u) => u.pathname === "/"), form.getByRole("button", { name: "Delete my account" }).click()]);
    assert(!(await admin.auth.admin.getUserById(uid.outsider)).data.user, "the account still exists");
    assert(((await admin.from("workspaces").select("id").eq("id", w)).data ?? []).length === 0, "their sole workspace still exists");
  }, { needs006: true });
} finally {
  await browser.close();
}
const failed = results.filter(([, s]) => s === false).length;
const skipped = results.filter(([, s]) => s === "skip").length;
console.log(`\n${results.filter(([, s]) => s === true).length}/${results.length - skipped} passed${skipped ? `, ${skipped} skipped (need migration 006)` : ""}. Screenshots and PDF: ${SHOTS}`);
process.exit(failed ? 1 : 0);
