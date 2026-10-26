// Phase 8: the complete organiser journey in one run, plus the final audits (roles, isolation, responsive, accessibility
// basics, error states, print output). Uses the disposable pre-confirmed accounts: this proves the product flow, NOT email delivery.
//
// Needs: dev server on :3000 started with PAYMENT_SANDBOX_ENABLED=true, migrations 001 to 008 applied, the accounts
// (npm run dev:users -- create) and the dev project's env file:
//   $env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e:p8
// Screenshots and the printed-summary PDF go to E2E_SHOTS (default <temp>/sceneset-p8) so a person can look at them.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.DEV_USERS_PASSWORD;
const SHOTS = process.env.E2E_SHOTS ?? join(tmpdir(), "sceneset-p8");
mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) {
  console.error("Set DEV_USERS_PASSWORD to the password printed by `npm run dev:users -- create`.");
  process.exit(2);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = (r) => `dev-${r}@example.test`;
const browser = await chromium.launch();
const results = [];
const step = async (name, fn) => {
  if (process.env.E2E_ONLY && !name.startsWith("J1 ") && !process.env.E2E_ONLY.split("|").some((s) => name.includes(s))) return;
  try {
    await fn();
    results.push([name, true]);
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push([name, false]);
    console.log(`FAIL ${name}\n     ${String(e.message).split("\n")[0]}`);
    if (process.env.E2E_VERBOSE) console.log(String(e.stack).split("\n").slice(0, 6).join("\n"));
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const newPage = async () => {
  const ctx = await browser.newContext({ baseURL: BASE });
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
  await page.getByText("Page not found").first().waitFor();
};
/** Wait for React to reset an add-form after the previous action, so a fresh fill is not wiped. */
const empty = (page, selector) => page.waitForFunction((s) => document.querySelector(s)?.value === "", selector);

const A = { owner: await newPage(), organiser: await newPage(), collab: await newPage(), outsider: await newPage() };
const owner = A.owner.page;
let ws, ev, base, quoteWinner;
const wsPlan = async () => (await admin.from("workspaces").select("plan").eq("id", ws).single()).data.plan;

try {
  // ============================================================ J1 workspace and event
  await step("J1 owner creates a workspace and an overnight event with a venue, capacity and budget", async () => {
    await signIn(owner, "owner");
    await owner.getByLabel("Workspace name").fill("Journey Events Co");
    await owner.getByRole("button", { name: "Create workspace" }).click();
    await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    ws = /\/w\/([0-9a-f-]{36})\//.exec(owner.url())[1];
    assert((await wsPlan()) === "free", "the journey must run on a Free workspace (no admin fixtures)");
    await owner.getByText("No events yet").waitFor();
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Type").selectOption("Party");
    await owner.getByLabel("Event title").fill("Harbour Night Market (journey)");
    await owner.getByLabel("Goals").fill("A sold-out night market with a calm, safe exit.");
    await owner.getByLabel("Starts").fill("2027-05-01T18:00");
    await owner.getByLabel("Ends").fill("2027-05-02T02:00");
    await owner.getByLabel("Capacity").fill("100");
    await owner.getByLabel("Budget target").fill("50,000");
    await owner.getByText("Or add a new venue").click();
    await owner.getByLabel("Venue name").fill("Pier 9 Courtyard");
    await owner.getByLabel("Width (m)").fill("20");
    await owner.getByLabel("Depth (m)").fill("15");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\/events\/[0-9a-f-]{36}\?m=created$/);
    ev = /\/events\/([0-9a-f-]{36})/.exec(owner.url())[1];
    base = `/w/${ws}/events/${ev}`;
    await owner.getByRole("heading", { name: "Harbour Night Market (journey)" }).waitFor();
    await owner.screenshot({ path: join(SHOTS, "j1-dashboard-new.png"), fullPage: true });
  });

  // ============================================================ J2 teammates and role restrictions
  await step("J2 owner adds an organiser and a collaborator; role restrictions hold in the UI and for non-members", async () => {
    await open(owner, `/w/${ws}/settings`);
    for (const [mail, role] of [[email("organiser"), "organiser"], [email("collaborator"), "collaborator"]]) {
      const form = owner.locator("form:has(input[name=email])");
      await form.getByLabel("Add a member by email").fill(mail);
      await form.getByLabel("Role").selectOption(role);
      await submit(owner, form.getByRole("button", { name: "Add member" }));
      await owner.getByText("Member added.").waitFor();
    }
    const o = A.organiser.page;
    await signIn(o, "organiser", `/w/${ws}/settings`);
    await o.getByText("Only owners can add members or change roles.").waitFor();
    assert((await o.getByLabel("Add a member by email").count()) === 0, "organiser can add members");
    await open(o, `/w/${ws}/events/new`);
    await o.getByLabel("Event title").waitFor(); // organisers may create events
    const c = A.collab.page;
    await signIn(c, "collaborator", `/w/${ws}/events/new`);
    await c.getByText("Only organisers and owners can create events").waitFor();
    await open(c, `${base}/budget`);
    assert((await c.locator("section[aria-labelledby=add-h]").count()) === 0, "collaborator sees the add-budget form");
    await open(c, `/w/${ws}/upgrade`);
    await c.locator("[data-owner-only]").waitFor();
    const x = A.outsider.page;
    await signIn(x, "outsider");
    for (const p of [`/w/${ws}/events`, base, `${base}/tasks`, `${base}/budget`, `${base}/suppliers`, `${base}/guests`, `${base}/schedule`, `${base}/layout`, `${base}/summary`, `/w/${ws}/settings`, `/w/${ws}/upgrade`]) await notFound(x, p);
  });

  // ============================================================ J3 tasks and notes
  await step("J3 tasks (assign, move) and notes work across roles", async () => {
    await open(owner, `${base}/tasks`);
    const form = owner.getByRole("form", { name: "Add a task" });
    for (const [title, assignee, due] of [["Confirm the stage supplier", "Dev collaborator", "2027-04-10"], ["Print stall signs", "Dev organiser", "2027-04-20"], ["Brief the stewards", "", "2027-04-25"]]) {
      await owner.waitForFunction(() => document.querySelector("form[aria-label='Add a task'] input[name=title]").value === "");
      await form.getByLabel("New task").fill(title);
      if (assignee) await form.getByLabel("Assign to").selectOption({ label: assignee });
      await form.getByLabel("Due").fill(due);
      await submit(owner, form.getByRole("button", { name: "Add task" }));
      await owner.locator(`[data-task="${title}"]`).waitFor();
    }
    await owner.locator('[data-task="Print stall signs"]').getByRole("button", { name: "Move to In progress" }).click();
    await owner.getByText("Task moved.").waitFor();
    const c = A.collab.page;
    await open(c, `${base}/tasks`);
    assert((await c.getByRole("form", { name: "Add a task" }).count()) === 0, "collaborator can add tasks");
    await c.locator('[data-task="Confirm the stage supplier"]').getByRole("button", { name: "Move to In progress" }).click();
    await c.getByText("Task moved.").waitFor();
    assert((await c.locator('[data-task="Print stall signs"]').getByRole("button", { name: /Move to/ }).count()) === 0, "collaborator can move someone else's task");
    await c.getByLabel("New note").fill("Stage arrives at 3pm; needs the north gate.");
    await c.getByRole("button", { name: "Add note" }).click();
    await owner.reload();
    await owner.locator("[data-note] p", { hasText: "Stage arrives at 3pm" }).waitFor();
  });

  // ============================================================ J4 suppliers, quotes, accept into the budget
  await step("J4 suppliers and quotes are compared and ONE accepted quote becomes ONE budget line", async () => {
    await open(owner, `${base}/suppliers`);
    for (const [name, category] of [["Lantern Co", "Decor"], ["Glow Works", "Decor"]]) {
      await empty(owner, 'form[aria-label="Add a supplier"] input[name=name]');
      const f = owner.locator('form[aria-label="Add a supplier"]');
      await f.getByLabel("Supplier name").fill(name);
      await f.getByLabel("Category").selectOption(category);
      await submit(owner, f.getByRole("button", { name: "Add supplier" }));
      await owner.getByText("Supplier added.").waitFor();
    }
    for (const [name, amount, scope] of [["Lantern Co", "4,000", "40 lanterns"], ["Glow Works", "3,200.50", "40 lanterns, delivery included"]]) {
      await empty(owner, "form:not(:has(input[name=item])) input[name=amount]");
      const f = owner.getByRole("heading", { name: "Add a quote" }).locator("..");
      const label = (await f.getByLabel("Supplier").locator("option").allInnerTexts()).find((o) => o.startsWith(`${name} (`));
      assert(label, `no option for ${name}`);
      await f.getByLabel("Supplier").selectOption({ label });
      await f.getByLabel(/Quoted amount/).fill(amount);
      await f.getByLabel("Scope").fill(scope);
      await submit(owner, f.getByRole("button", { name: "Add quote" }));
      await owner.locator(`[data-quote="${name}"]`).waitFor();
    }
    quoteWinner = "Glow Works";
    assert(/lowest/i.test(await text(owner.locator("main"))), "the lowest quote is not marked");
    const row = owner.locator(`[data-quote="${quoteWinner}"]`);
    await row.getByText("Accept…").click();
    await submit(owner, row.getByRole("button", { name: "Accept quote" }));
    await owner.getByText("Quote accepted and linked to a budget line").waitFor();
    await submit(owner, owner.locator('[data-quote="Lantern Co"]').getByRole("button", { name: "Reject" }));
    await open(owner, `${base}/budget`);
    assert((await owner.locator('[data-line="Glow Works"]').count()) === 1, "the accepted quote did not create exactly one budget line");
    assert(/HKD 3,200\.50 HKD 3,200\.50 HKD 0 HKD 3,200\.50 Accepted quote/.test(await text(owner.locator('[data-line="Glow Works"]'))), "the budget line amounts are wrong");
  });

  // ============================================================ J5 spending
  await step("J5 spending: a manual line, paid amounts and remaining totals are consistent and reach the dashboard", async () => {
    const f = owner.locator("section[aria-labelledby=add-h]");
    await empty(owner, "section[aria-labelledby=add-h] input[name=name]");
    await f.getByLabel("Category").selectOption("Sound & lighting");
    await f.getByLabel("Item").fill("Sound hire");
    await f.getByLabel(/Planned/).fill("3,000");
    await f.getByLabel(/Committed/).fill("2,800");
    await f.getByLabel(/Paid/).fill("1,000");
    await submit(owner, f.getByRole("button", { name: "Add line" }));
    await owner.locator('[data-line="Sound hire"]').waitFor();
    const t = await text(owner.locator('section[aria-label="Totals for all budget lines"]'));
    assert(/Committed HKD 6,000\.50/.test(t) && /Paid HKD 1,000/.test(t) && /Outstanding HKD 5,000\.50/.test(t) && /Remaining HKD 43,999\.50/.test(t), t); // target 50,000 minus committed 6,000.50
    await open(owner, base);
    assert(/HKD 6,000\.50/.test(await text(owner.locator("section[aria-labelledby=d-budget]"))), "the dashboard budget differs from the budget page");
  });

  // ============================================================ J6 guests
  await step("J6 guests and RSVPs: party sizes make headcount, which is compared with capacity", async () => {
    await open(owner, `${base}/guests`);
    for (const [name, party, rsvp] of [["Amy Party", "4", "confirmed"], ["Ben", "1", "confirmed"], ["Cara Group", "3", "tentative"], ["Dev Press", "2", "invited"]]) {
      await empty(owner, "section[aria-labelledby=add-guest] input[name=name]");
      const f = owner.locator("section[aria-labelledby=add-guest]");
      await f.getByLabel("Guest or party name").fill(name);
      await f.getByLabel("People in this party").fill(party);
      await f.getByLabel("RSVP status").selectOption(rsvp);
      await submit(owner, f.getByRole("button", { name: "Add guest" }));
      await owner.locator(`[data-guest="${name}"]`).waitFor();
    }
    await open(owner, base);
    const g = await text(owner.locator("section[aria-labelledby=d-guests]"));
    assert(/5 people attending \(confirmed\) of 100 capacity/.test(g), g); // Amy 4 + Ben 1
    assert(/4 guest records/.test(g), g);
  });

  // ============================================================ J7 overnight running order
  await step("J7 overnight running order: an entry crossing midnight is accepted, ordered and marked", async () => {
    await open(owner, `${base}/schedule`);
    for (const [title, s, e] of [["Doors open", "2027-05-01T18:00", "2027-05-01T19:00"], ["Pack-down", "2027-05-01T23:00", "2027-05-02T01:00"]]) {
      await empty(owner, "section[aria-labelledby=add-entry] input[name=title]");
      const f = owner.locator("section[aria-labelledby=add-entry]");
      await f.getByLabel("Activity").fill(title);
      await f.getByLabel("Starts").fill(s);
      await f.getByLabel("Ends").fill(e);
      await submit(owner, f.getByRole("button", { name: "Add entry" }));
      await owner.locator(`[data-entry="${title}"]`).waitFor();
    }
    const t = await text(owner.locator('[data-entry="Pack-down"]'));
    assert(/\+1 day/.test(t) && /Overnight/.test(t) && /2 h/.test(t), t);
    const order = await owner.locator("[data-entry]").evaluateAll((els) => els.map((e) => e.getAttribute("data-entry")));
    assert(order.join() === "Doors open,Pack-down", order.join());
  });

  // ============================================================ J8 venue layout
  await step("J8 venue layout: objects are added in the planner, saved, and survive a reload", async () => {
    await open(owner, `${base}/layout`);
    const add = owner.getByRole("form", { name: "Add an object" });
    await add.getByLabel("Kind").selectOption("table");
    await add.getByLabel("Label").fill("Table 1");
    await add.getByRole("button", { name: "Add to the plan" }).click();
    // React resets the uncontrolled add-form after the action; choosing the next kind before that would be wiped
    await owner.waitForFunction(() => document.querySelector("form[aria-label='Add an object'] input[name=label]").value === "");
    await add.getByLabel("Kind").selectOption("stage");
    await add.getByLabel("Label").fill("Main stage");
    await add.getByRole("button", { name: "Add to the plan" }).click();
    await submit(owner, owner.getByRole("button", { name: "Save layout" }));
    await open(owner, `${base}/layout`);
    assert((await owner.locator("svg [role=button]").count()) === 2, "the saved objects did not come back");
    assert(/Main stage Stage/.test(await text(owner.locator('[data-row="Main stage"]'))) && /Table 1 Table/.test(await text(owner.locator('[data-row="Table 1"]'))), "the saved kinds are wrong");
    await owner.screenshot({ path: join(SHOTS, "j8-layout.png"), fullPage: true });
  });

  // ============================================================ J9 readiness and print
  await step("J9 readiness is 11 of 11 and the printed plan contains every section without navigation or clipping", async () => {
    await open(owner, base);
    const pct = Number(await owner.locator("[data-readiness]").first().getAttribute("data-readiness"));
    const open_ = await owner.locator("[data-check][data-done=false]").evaluateAll((els) => els.map((e) => e.getAttribute("data-check")));
    assert(pct === 100 && open_.length === 0, `readiness ${pct}%, open: ${open_.join(",")}`);
    // Print is laid out at the paper width, so check it in an A4-wide page (a desktop-width window is not what a printer uses).
    const { ctx, page } = await (async () => {
      const c = await browser.newContext({ baseURL: BASE, viewport: { width: 794, height: 1123 }, storageState: await owner.context().storageState() });
      const pg = await c.newPage();
      pg.setDefaultTimeout(15000);
      return { ctx: c, page: pg };
    })();
    try {
      await open(page, `${base}/summary`);
      await page.emulateMedia({ media: "print" });
      const rep = await page.evaluate(() => {
        const vis = (e) => { const st = getComputedStyle(e); const r = e.getBoundingClientRect(); return st.display !== "none" && st.visibility !== "hidden" && r.width > 0 && r.height > 0; };
        return {
          chrome: [...document.querySelectorAll("aside, nav, button, form, input, select, textarea")].filter(vis).map((e) => e.tagName + ":" + (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 25)),
          wide: [...document.querySelectorAll("body *")].filter((e) => vis(e) && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length,
        };
      });
      assert(rep.chrome.length === 0, "navigation or controls visible in print: " + rep.chrome.join(", "));
      assert(rep.wide === 0, rep.wide + " elements are wider than the printed page");
      await page.screenshot({ path: join(SHOTS, "journey-summary-print.png"), fullPage: true });
      const pdf = join(SHOTS, "journey-summary.pdf");
      writeFileSync(pdf, await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
      const txt = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
      for (const needle of ["Harbour Night Market (journey)", "Confirm the stage supplier", "Glow Works", "Sound hire", "Amy Party", "Pack-down", "Main stage", "Readiness", "Printed from SceneSet"]) assert(txt.includes(needle), "the printed plan lacks " + needle);
      assert(!/Sign out|Print the layout|Add guest|Save layout/.test(txt), "controls appear in the printed plan");
    } finally {
      await ctx.close();
    }
  });

  // ============================================================ J10 sandbox upgrades and Free-plan limits
  await step("J10 Free limits and test upgrades: second event and fourth member are refused; Event Upgrade then Organiser change the limits", async () => {
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("Second event");
    await owner.getByLabel("Starts").fill("2027-06-01T10:00");
    await owner.getByLabel("Ends").fill("2027-06-01T12:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.getByText(/The free plan allows 1 active event/).waitFor();
    await open(owner, `/w/${ws}/settings`);
    let form = owner.locator("form:has(input[name=email])");
    await form.getByLabel("Add a member by email").fill(email("outsider"));
    await submit(owner, form.getByRole("button", { name: "Add member" }));
    await owner.getByText(/member limit is reached/).waitFor();
    await open(owner, `/w/${ws}/upgrade`);
    await owner.getByLabel("Event to upgrade").selectOption(ev);
    await owner.getByRole("button", { name: "Try the test upgrade" }).click();
    await owner.getByText(/Test mode — No real payment taken/).waitFor();
    await submit(owner, owner.getByRole("button", { name: "Simulate success" }));
    await owner.getByText(/Test upgrade recorded/).waitFor();
    await open(owner, `/w/${ws}/settings`);
    form = owner.locator("form:has(input[name=email])");
    await form.getByLabel("Add a member by email").fill(email("outsider"));
    await submit(owner, form.getByRole("button", { name: "Add member" }));
    await owner.getByText("Member added.").waitFor();
    await open(owner, `/w/${ws}/upgrade`);
    await owner.getByRole("link", { name: "Try the test plan" }).click();
    await submit(owner, owner.getByRole("button", { name: "Simulate cancellation" }));
    await owner.getByText(/Checkout cancelled/).waitFor();
    assert((await wsPlan()) === "free", "a cancelled checkout changed the plan");
    await owner.getByRole("link", { name: "Try the test plan" }).click();
    await submit(owner, owner.getByRole("button", { name: "Simulate success" }));
    await owner.getByText(/Test upgrade recorded/).waitFor();
    assert((await wsPlan()) === "organiser", "Organiser was not recorded");
  });

  // ============================================================ J11 refresh, reauthenticate, persistence
  await step("J11 after a refresh and after signing out and in, every saved view shows the same data", async () => {
    const views = [base, `${base}/tasks`, `${base}/suppliers`, `${base}/budget`, `${base}/guests`, `${base}/schedule`, `${base}/layout`, `/w/${ws}/upgrade`];
    const grab = async () => {
      const out = [];
      for (const v of views) {
        await open(owner, v);
        out.push((await text(owner.locator("main"))).replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/g, "<time>"));
      }
      return out;
    };
    const before = await grab();
    await owner.reload();
    await owner.getByRole("button", { name: "Sign out" }).click();
    await owner.waitForURL((u) => u.pathname === "/" || u.pathname === "/login");
    await open(owner, base);
    assert(/\/login/.test(owner.url()), "private page opened while signed out");
    await signIn(owner, "owner", base);
    const after = await grab();
    for (let i = 0; i < views.length; i++) assert(before[i] === after[i], `${views[i]} changed after re-login`);
  });

  // ============================================================ J12 isolation again at the end of the journey
  await step("J12 a user from another workspace still reaches nothing, and the only owner is protected", async () => {
    const x = A.outsider.page;
    // the outsider was added as a member in J10; remove them so this checks a genuine non-member
    await open(owner, `/w/${ws}/settings`);
    const row = owner.getByRole("row", { name: /Dev outsider/ });
    await row.getByRole("button", { name: "Remove" }).click();
    await submit(owner, owner.getByRole("button", { name: "Remove member" }));
    await owner.getByText("Member removed.").waitFor();
    for (const p of [`/w/${ws}/events`, base, `${base}/budget`, `/w/${ws}/settings`]) await notFound(x, p);
    const ownerRow = owner.getByRole("row", { name: /Dev owner/ });
    await ownerRow.getByLabel("Role").selectOption("organiser");
    await ownerRow.getByRole("button", { name: "Update" }).click();
    await owner.getByText("A workspace must keep at least one owner").waitFor();
  });

  // ============================================================ final audits
  const ROUTES = (w, e) => [`/w/${w}/events`, `/w/${w}/events/${e}`, `/w/${w}/events/${e}/tasks`, `/w/${w}/events/${e}/suppliers`, `/w/${w}/events/${e}/budget`, `/w/${w}/events/${e}/guests`, `/w/${w}/events/${e}/schedule`, `/w/${w}/events/${e}/layout`, `/w/${w}/events/${e}/summary`, `/w/${w}/events/${e}/edit`, `/w/${w}/settings`, `/w/${w}/upgrade`];
  await step("AUDIT responsive: no page-level horizontal overflow at 375, 768, 1024 and 1440 px on every signed-in view", async () => {
    const bad = [];
    for (const [w, h] of [[375, 812], [768, 1024], [1024, 768], [1440, 900]]) {
      await owner.setViewportSize({ width: w, height: h });
      for (const r of ROUTES(ws, ev)) {
        await open(owner, r);
        const o = await owner.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (o > 0) bad.push(`${w}px ${r.replace(ws, "<ws>").replace(ev, "<ev>")} +${o}`);
      }
      await owner.screenshot({ path: join(SHOTS, `audit-settings-${w}.png`), fullPage: true });
    }
    await owner.setViewportSize({ width: 1280, height: 800 });
    assert(bad.length === 0, bad.join("; "));
  });
  await step("AUDIT accessibility basics: one h1 and a main landmark per page; named navs; labelled controls; skip link; 44 px targets; visible focus", async () => {
    const bad = [];
    const small = new Map();
    const pub = ["/", "/pricing", "/privacy", "/login", "/signup", "/forgot-password", "/demo", "/demo/summary"];
    for (const r of [...ROUTES(ws, ev), ...pub]) {
      await open(owner, r);
      const f = await owner.evaluate(() => {
        const vis = (el) => !!(el.offsetWidth || el.offsetHeight) && getComputedStyle(el).visibility !== "hidden";
        const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim();
        const unlabeled = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter(vis).filter((el) => !(el.labels && el.labels.length) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby"));
        const nonameBtn = [...document.querySelectorAll("button, a[href], [role=button]")].filter(vis).filter((el) => !name(el) && !el.querySelector("img[alt]"));
        const navs = [...document.querySelectorAll("nav")].filter((n) => !n.getAttribute("aria-label") && !n.getAttribute("aria-labelledby"));
        const small = [...document.querySelectorAll("button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select")].filter(vis).filter((el) => el.getBoundingClientRect().height < 43.5 && !el.closest("[hidden]")).map((el) => `${el.tagName.toLowerCase()}:${(name(el) || el.name || "").slice(0, 20)}`);
        return { h1: document.querySelectorAll("h1").length, main: document.querySelectorAll("main").length, unlabeled: unlabeled.map((e) => e.name || e.id), nonameBtn: nonameBtn.length, navs: navs.length, small };
      });
      const tag = r.replace(ws, "<ws>").replace(ev, "<ev>");
      if (f.h1 !== 1) bad.push(`${tag}: ${f.h1} h1`);
      if (f.main !== 1) bad.push(`${tag}: ${f.main} main`);
      if (f.unlabeled.length) bad.push(`${tag}: unlabelled ${f.unlabeled.join(",")}`);
      if (f.nonameBtn) bad.push(`${tag}: ${f.nonameBtn} controls without a name`);
      if (f.navs) bad.push(`${tag}: ${f.navs} unnamed nav`);
      for (const x of f.small) small.set(x, (small.get(x) ?? new Set()).add(tag));
    }
    for (const [k, routes] of small) bad.push(`under 44px: ${k} on ${routes.size} page(s), e.g. ${[...routes][0]}`);
    // keyboard: the first Tab stop is the skip link, and the next stops show a visible focus indicator
    await open(owner, base);
    await owner.keyboard.press("Tab");
    assert(/Skip to main content/.test(await owner.evaluate(() => document.activeElement.textContent)), "first Tab stop is not the skip link");
    await owner.keyboard.press("Enter");
    assert((await owner.evaluate(() => location.hash)) === "#main", "the skip link does not jump to main");
    for (let i = 0; i < 12; i++) {
      await owner.keyboard.press("Tab");
      const o = await owner.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), tag: document.activeElement.tagName, shadow: s.boxShadow }; });
      if (o.tag !== "BODY" && !((o.style !== "none" && o.width > 0) || o.shadow !== "none")) bad.push(`dashboard Tab stop ${i + 1} has no visible focus`);
    }
    assert(bad.length === 0, bad.slice(0, 12).join("; ") + (bad.length > 12 ? ` (+${bad.length - 12} more)` : ""));
  });
  await step("AUDIT error and network states: a save attempted offline is never reported as saved, nothing is half-written, and saved data is intact", async () => {
    await open(owner, `${base}/tasks`);
    const before = await owner.locator("[data-task]").count();
    const form = owner.getByRole("form", { name: "Add a task" });
    await form.getByLabel("New task").fill("Offline task must not exist");
    await owner.context().setOffline(true);
    await form.getByRole("button", { name: "Add task" }).click();
    await owner.waitForTimeout(2500);
    const body = await owner.locator("body").innerText();
    await owner.context().setOffline(false);
    assert(!/Task added\.|Task moved\./.test(body), `a success message appeared while offline: ${body.slice(0, 160)}`);
    await owner.getByRole("heading", { name: "Something went wrong" }).waitFor(); // the failure is shown plainly and says the save may not have happened
    await owner.screenshot({ path: join(SHOTS, "error-offline.png") }); // the failure is shown plainly and says the save may not have happened
    await open(owner, `${base}/tasks`);
    assert((await owner.locator("[data-task]").count()) === before, "the number of tasks changed");
    assert((await owner.locator('[data-task="Offline task must not exist"]').count()) === 0, "an offline save was recorded");
    await owner.getByText("Confirm the stage supplier").first().waitFor(); // earlier data intact
  });
  await step("AUDIT unknown and malformed ids give the same plain not-found page, signed in and signed out", async () => {
    for (const p of [`/w/not-a-uuid/events`, `/w/${ws}/events/not-a-uuid`, `/w/${ws}/events/00000000-0000-0000-0000-000000000000`, `/w/00000000-0000-0000-0000-000000000000/events`, "/demo/nonsense", "/no-such-page"]) await notFound(owner, p);
    const anon = await newPage();
    await open(anon.page, `/w/${ws}/events`);
    assert(/\/login\?next=/.test(anon.page.url()), `signed-out deep link landed on ${anon.page.url()}`);
    await open(anon.page, "/login?next=//evil.example");
    await anon.page.getByLabel("Email").fill(email("owner"));
    await anon.page.getByLabel("Password").fill(PASSWORD);
    await anon.page.getByRole("button", { name: "Sign in" }).click();
    await anon.page.waitForURL((u) => !u.pathname.startsWith("/login"));
    assert(new URL(anon.page.url()).host === new URL(BASE).host, `an off-site next was followed: ${anon.page.url()}`);
    await anon.ctx.close();
  });
  await step("AUDIT screenshots of the finished product for visual review (desktop and phone)", async () => {
    for (const [w, h, tag] of [[1440, 900, "1440"], [375, 812, "375"]]) {
      await owner.setViewportSize({ width: w, height: h });
      for (const [slug, p] of [["landing", "/"], ["pricing", "/pricing"], ["events", `/w/${ws}/events`], ["dashboard", base], ["tasks", `${base}/tasks`], ["suppliers", `${base}/suppliers`], ["budget", `${base}/budget`], ["guests", `${base}/guests`], ["schedule", `${base}/schedule`], ["summary", `${base}/summary`], ["settings", `/w/${ws}/settings`], ["plan", `/w/${ws}/upgrade`]]) {
        await open(owner, p);
        await owner.screenshot({ path: join(SHOTS, `${slug}-${tag}.png`), fullPage: true });
      }
    }
    await owner.setViewportSize({ width: 1280, height: 800 });
  });
} finally {
  await browser.close();
}
const failed = results.filter(([, s]) => s === false).length;
console.log(`\n${results.filter(([, s]) => s === true).length}/${results.length} passed. Screenshots and PDF: ${SHOTS}`);
process.exit(failed ? 1 : 0);
