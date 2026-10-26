// Browser checks for phase 4: supplier directory, quote comparison and decisions, accept-to-budget linking,
// budget lines and totals, dashboard budget summary, role limits and persistence.
// One isolated browser context per role. Needs the dev server on :3000, the disposable accounts, and
// migration 005 applied to the dev project:
//   $env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e:p4
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
      console.log("--- owner page text:", (await owner.locator("main").innerText().catch(() => "")).slice(0, 1800));
    }
    if (process.env.E2E_STOP_AFTER_FAIL) throw new Error("stopping after first failure");
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
let ws, ev, ev2, base;

// ---- page helpers (owner)
const supplierForm = () => owner.locator('form[aria-label="Add a supplier"]');
const addSupplier = async (name, category) => {
  await empty(owner, 'form[aria-label="Add a supplier"] input[name=name]');
  const f = supplierForm();
  await f.getByLabel("Supplier name").fill(name);
  await f.getByLabel("Category").selectOption(category);
  await submit(owner, f.getByRole("button", { name: "Add supplier" }));
  await owner.getByText("Supplier added.").waitFor();
};
const quoteForm = () => owner.getByRole("heading", { name: "Add a quote" }).locator("..");
const addQuote = async (supplierName, amount, scope = "") => {
  await empty(owner, "form:not(:has(input[name=item])) input[name=amount]"); // the add form (edit forms carry an `item` field)
  const f = quoteForm();
  const opts = await f.getByLabel("Supplier").locator("option").allInnerTexts();
  const label = opts.find((o) => o.startsWith(`${supplierName} (`));
  assert(label, `no supplier option for ${supplierName}`);
  await f.getByLabel("Supplier").selectOption({ label });
  await f.getByLabel(/Quoted amount/).fill(amount);
  if (scope) await f.getByLabel("Scope").fill(scope);
  await submit(owner, f.getByRole("button", { name: "Add quote" }));
};
const budgetForm = () => owner.locator("section[aria-labelledby=add-h]");
const addLine = async (category, name, { planned = "", committed = "", paid = "" } = {}) => {
  await empty(owner, "section[aria-labelledby=add-h] input[name=name]");
  const f = budgetForm();
  await f.getByLabel("Category").selectOption(category);
  await f.getByLabel("Item").fill(name);
  await f.getByLabel(/Planned/).fill(planned);
  await f.getByLabel(/Committed/).fill(committed);
  await f.getByLabel(/Paid/).fill(paid);
  await submit(owner, f.getByRole("button", { name: "Add line" }));
};
const totalsText = async (page, label = "Totals for all budget lines") => text(page.locator(`section[aria-label="${label}"]`));

try {
  // ------------------------------------------------------------------ setup
  await step("setup: owner creates a workspace, adds an organiser and a collaborator, and an event with a 10,000 target", async () => {
    await signIn(owner, "owner");
    await owner.getByLabel("Workspace name").fill("P4 Budget Co");
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
    await owner.getByLabel("Event title").fill("Budget Fest");
    await owner.getByLabel("Starts").fill("2026-11-14T15:00");
    await owner.getByLabel("Ends").fill("2026-11-14T23:00");
    await owner.getByLabel("Budget target").fill("10,000");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\?m=created$/);
    ev = /\/events\/([0-9a-f-]{36})/.exec(owner.url())[1];
    base = `/w/${ws}/events/${ev}`;
  });

  // ------------------------------------------------------------------ empty states
  await step("empty budget and supplier pages explain what to do; dashboard shows the target without invented figures", async () => {
    await open(owner, `${base}/budget`);
    await owner.getByText("No budget lines yet").waitFor();
    const t = await totalsText(owner);
    assert(/Planned HKD 0/.test(t) && /Committed HKD 0/.test(t) && /Paid HKD 0/.test(t), t);
    assert(!/NaN|Infinity|undefined/.test(t), `bad number in: ${t}`);
    await open(owner, `${base}/suppliers`);
    await owner.getByText("No quotes yet.").waitFor();
    await owner.getByText("No suppliers yet.").waitFor();
    await open(owner, base);
    const d = await text(owner.locator("section[aria-labelledby=d-budget]"));
    assert(/Target HKD 10,000/.test(d) && /Committed HKD 0/.test(d) && /Remaining HKD 10,000/.test(d), d);
  });

  // ------------------------------------------------------------------ suppliers (P4.1, P4.2)
  await step("suppliers: add three, edit one, search, category filter, no-results and clear", async () => {
    await open(owner, `${base}/suppliers`);
    await addSupplier("Lantern Co", "Decor");
    await addSupplier("Glow Works", "Decor");
    await addSupplier("Sound Crew", "Sound & lighting");
    await addSupplier("Temp Supplier", "Other");
    const row = owner.locator('[data-supplier="Sound Crew"]');
    await row.getByText("Edit supplier").click();
    await row.getByLabel("Contact or reference").fill("Ref SC-104");
    await submit(owner, row.getByRole("button", { name: "Save supplier" }));
    await owner.getByText("Supplier saved.").waitFor();
    assert((await text(owner.locator('[data-supplier="Sound Crew"]'))).includes("Ref SC-104"), "edit not saved");
    await open(owner, `${base}/suppliers?q=glow`);
    await owner.locator('[data-supplier="Glow Works"]').waitFor();
    assert((await owner.locator('[data-supplier="Lantern Co"]').count()) === 0, "search leaked");
    await open(owner, `${base}/suppliers?category=Sound%20%26%20lighting`);
    await owner.locator('[data-supplier="Sound Crew"]').waitFor();
    assert((await owner.locator('[data-supplier="Glow Works"]').count()) === 0, "category filter leaked");
    await open(owner, `${base}/suppliers?q=zzz`);
    await owner.getByText("No suppliers match those filters.").first().waitFor();
    await owner.getByRole("link", { name: "Clear filters" }).first().click();
    await owner.locator('[data-supplier="Lantern Co"]').waitFor();
  });
  await step("a supplier with no quotes can be deleted after confirmation", async () => {
    await open(owner, `${base}/suppliers`);
    const row = owner.locator('[data-supplier="Temp Supplier"]');
    await row.getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete supplier" }).click();
    await owner.getByText("Supplier deleted.").waitFor();
    assert((await owner.locator('[data-supplier="Temp Supplier"]').count()) === 0, "still listed");
  });

  // ------------------------------------------------------------------ quotes (P4.3, P4.4)
  await step("quote form: invalid amounts show errors and keep what was typed; nothing is saved", async () => {
    await open(owner, `${base}/suppliers`);
    for (const bad of ["-5", "12.345", ""]) {
      const f = quoteForm();
      const opts = await f.getByLabel("Supplier").locator("option").allInnerTexts();
      await f.getByLabel("Supplier").selectOption({ label: opts.find((o) => o.startsWith("Lantern Co (")) });
      await f.getByLabel(/Quoted amount/).fill(bad);
      await f.getByLabel("Scope").fill("keep me");
      await submit(owner, f.getByRole("button", { name: "Add quote" })); // wait for the server round trip, not for stale text
      try {
        await f.getByText(bad === "" ? "Enter the quoted amount." : /Enter an amount like/).waitFor();
      } catch (e) {
        if (process.env.E2E_VERBOSE) console.log(`--- add-quote form after submitting ${JSON.stringify(bad)}:`, (await f.innerText()).slice(0, 700));
        throw e;
      }
      assert((await f.getByLabel("Scope").inputValue()) === "keep me", "scope lost");
      assert((await f.getByLabel("Supplier").locator("option:checked").innerText()).startsWith("Lantern Co"), "chosen supplier reverted after the error");
      assert((await f.getByLabel(/Quoted amount/).inputValue()) === bad, "amount lost");
    }
    await owner.getByText("No quotes yet.").waitFor();
  });
  await step("three quotes are recorded and shown side by side per category, with the lowest marked", async () => {
    await open(owner, `${base}/suppliers`);
    await addQuote("Lantern Co", "4,000", "40 lanterns");
    await owner.getByText("Quote added.").waitFor();
    await addQuote("Glow Works", "3,200.50", "40 lanterns, delivery included");
    await owner.getByText("Quote added.").waitFor();
    await addQuote("Sound Crew", "2,500");
    await owner.getByText("Quote added.").waitFor();
    const decor = owner.locator("table").filter({ has: owner.locator('[data-quote="Lantern Co"]') });
    assert((await decor.locator("tbody tr").count()) === 2, "decor group should hold both quotes");
    const lowest = await text(owner.locator('[data-quote="Glow Works"]'));
    assert(/HKD 3,200\.50 Lowest/.test(lowest), lowest);
    assert(!/Lowest/.test(await text(owner.locator('[data-quote="Lantern Co"]'))), "wrong quote marked lowest");
    assert((await text(owner.locator('[data-quote="Sound Crew"]'))).includes("HKD 2,500"), "sound quote missing");
  });
  await step("a supplier that has quotes cannot be deleted and the message says why", async () => {
    const row = owner.locator('[data-supplier="Lantern Co"]');
    await row.getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete supplier" }).click();
    await owner.getByText("has quotes, so it cannot be deleted").waitFor();
    await owner.locator('[data-supplier="Lantern Co"]').waitFor();
  });
  await step("shortlist and reject change status and persist after reload", async () => {
    await submit(owner, owner.locator('[data-quote="Glow Works"]').getByRole("button", { name: "Shortlist" }));
    await owner.getByText("Quote status updated.").waitFor();
    await submit(owner, owner.locator('[data-quote="Lantern Co"]').getByRole("button", { name: "Reject" }));
    await owner.reload();
    assert((await text(owner.locator('[data-quote="Glow Works"]'))).includes("Shortlisted"), "shortlist lost");
    assert((await text(owner.locator('[data-quote="Lantern Co"]'))).includes("Rejected"), "reject lost");
    assert(!/Lowest/.test(await text(owner.locator('[data-quote="Lantern Co"]'))), "rejected quote still marked lowest");
  });
  await step("editing a quote persists; a stale second tab is refused", async () => {
    const a = await owner.context().newPage();
    const b = await owner.context().newPage();
    for (const p of [a, b]) await open(p, `${base}/suppliers`);
    const edit = (p) => p.locator('[data-quote="Sound Crew"]');
    await edit(a).getByText("Edit quote").click();
    await edit(b).getByText("Edit quote").click();
    await edit(a).getByLabel("Scope").fill("PA and lights, 6 hours");
    await submit(a, edit(a).getByRole("button", { name: "Save quote" }));
    await a.getByText("Quote saved.").waitFor();
    await edit(b).getByLabel("Scope").fill("stale overwrite attempt");
    await edit(b).getByRole("button", { name: "Save quote" }).click();
    await b.getByText("changed by someone else").waitFor();
    await open(b, `${base}/suppliers`);
    assert((await text(edit(b))).includes("PA and lights, 6 hours"), "first save was overwritten");
    await a.close();
    await b.close();
  });

  // ------------------------------------------------------------------ accept -> budget (P4.7)
  await step("accepting a quote creates ONE budget line; nothing is counted twice", async () => {
    const row = owner.locator('[data-quote="Glow Works"]');
    await row.getByText("Accept…").click();
    const btn = row.getByRole("button", { name: "Accept quote" });
    // a rapid double click: the button disables itself after the first, and the database is idempotent anyway
    let posts = 0;
    const count = (req) => req.method() === "POST" && posts++;
    owner.on("request", count);
    await Promise.all([owner.waitForResponse((r) => r.request().method() === "POST"), btn.dblclick().catch(() => {})]);
    await owner.waitForLoadState("networkidle");
    owner.off("request", count);
    assert(posts === 1, `the double click sent ${posts} requests; the button should disable itself after the first`);
    await owner.getByText("Quote accepted and linked to a budget line").waitFor();
    assert((await text(owner.locator('[data-quote="Glow Works"]'))).includes("Accepted"), "status not accepted");
    await open(owner, `${base}/budget`);
    assert((await owner.locator('[data-line="Glow Works"]').count()) === 1, "duplicate or missing budget line");
    const line = await text(owner.locator('[data-line="Glow Works"]'));
    assert(/HKD 3,200\.50 HKD 3,200\.50 HKD 0 HKD 3,200\.50 Accepted quote/.test(line), line); // planned, committed, paid, outstanding, source
    const t = await totalsText(owner);
    assert(/Committed HKD 3,200\.50/.test(t) && /Planned HKD 3,200\.50/.test(t), t);
  });
  await step("an accepted quote cannot be edited or accepted again; the page offers Re-open instead", async () => {
    await open(owner, `${base}/suppliers`);
    const row = owner.locator('[data-quote="Glow Works"]');
    assert((await row.getByText("Accept…").count()) === 0, "Accept offered again");
    assert((await row.getByRole("button", { name: "Re-open" }).count()) === 1, "no Re-open");
    await row.getByText("Edit quote").click();
    assert((await row.getByLabel(/Quoted amount/).getAttribute("readonly")) !== null, "amount editable while accepted");
  });
  await step("accepting into an existing line REPLACES its committed amount (no double counting)", async () => {
    await open(owner, `${base}/budget`);
    await addLine("Sound & lighting", "Sound hire (manual)", { planned: "3,000", committed: "2,800", paid: "1,000" });
    await owner.getByText("Budget line added.").waitFor();
    await open(owner, `${base}/suppliers`);
    const row = owner.locator('[data-quote="Sound Crew"]');
    await row.getByText("Accept…").click();
    await row.getByLabel("Budget line").selectOption({ label: "Sound hire (manual) (Sound & lighting)" });
    await submit(owner, row.getByRole("button", { name: "Accept quote" }));
    await owner.getByText("Quote accepted").waitFor();
    await open(owner, `${base}/budget`);
    assert((await owner.locator('[data-line="Sound hire (manual)"]').count()) === 1 && (await owner.locator("[data-line]").count()) === 2, "line count wrong");
    const line = await text(owner.locator('[data-line="Sound hire (manual)"]'));
    assert(/HKD 3,000 HKD 2,500 HKD 1,000 HKD 1,500/.test(line), line);
  });
  await step("totals are exact: planned, committed, paid, outstanding, remaining, variance (with sign wording)", async () => {
    const t = await totalsText(owner);
    // planned 3,200.50 + 3,000 | committed 3,200.50 + 2,500 | paid 1,000
    assert(/Planned HKD 6,200\.50/.test(t), t);
    assert(/Committed HKD 5,700\.50/.test(t), t);
    assert(/Paid HKD 1,000/.test(t), t);
    assert(/Outstanding HKD 4,700\.50/.test(t), t);
    assert(/Remaining HKD 4,299\.50/.test(t) && /Left to commit/.test(t), t);
    assert(/Variance -HKD 500/.test(t) && /Below plan/.test(t), t);
    const foot = await text(owner.locator("tfoot"));
    assert(/Total, all lines HKD 6,200\.50 HKD 5,700\.50 HKD 1,000 HKD 4,700\.50/.test(foot), foot);
  });
  await step("budget line form: invalid amounts are rejected with typed values kept; nothing is saved", async () => {
    const before = await owner.locator("[data-line]").count();
    const f = budgetForm();
    for (const [field, value, msg] of [["Planned", "-1", /Planned: Enter an amount/], ["Committed", "1.234", /Committed: Enter an amount/], ["Paid", "abc", /Paid: Enter an amount/]]) {
      await f.getByLabel("Item").fill("Bad line");
      await f.getByLabel(new RegExp(field)).fill(value);
      await f.getByRole("button", { name: "Add line" }).click();
      await f.getByText(msg).waitFor();
      assert((await f.getByLabel("Item").inputValue()) === "Bad line", "typed item lost");
      await f.getByLabel(new RegExp(field)).fill("");
    }
    await f.getByLabel("Item").fill("Bad line");
    await f.getByLabel(/Committed/).fill("100");
    await f.getByLabel(/Paid/).fill("100.01");
    await f.getByRole("button", { name: "Add line" }).click();
    await f.getByText("Paid cannot be more than the committed amount.").waitFor();
    assert((await owner.locator("[data-line]").count()) === before, "an invalid line was saved");
  });
  await step("editing a line persists; a quote-linked line has a read-only committed amount; stale edit is refused", async () => {
    await open(owner, `${base}/budget`);
    const line = () => owner.locator('[data-line="Glow Works"]');
    await line().getByText("Edit line").click();
    assert((await line().getByLabel(/Committed/).getAttribute("readonly")) !== null, "committed editable on a linked line");
    await line().getByLabel(/Planned/).fill("3,500");
    await line().getByLabel(/Paid/).fill("200.25");
    await submit(owner, line().getByRole("button", { name: "Save line" }));
    await owner.getByText("Budget line saved.").waitFor();
    await owner.reload();
    await owner.waitForFunction(() => ![...document.querySelectorAll("[role=status]")].some((e) => e.textContent.includes("Loading…")) && !document.querySelector('div[hidden][id^="S:"]'));
    assert(/HKD 3,500 HKD 3,200\.50 HKD 200\.25 HKD 3,000\.25/.test(await text(line())), await text(line()));
    // stale: two tabs edit the same line
    const a = await owner.context().newPage();
    const b = await owner.context().newPage();
    for (const p of [a, b]) {
      await open(p, `${base}/budget`);
      await p.locator('[data-line="Glow Works"]').getByText("Edit line").click();
    }
    await a.locator('[data-line="Glow Works"]').getByLabel(/Planned/).fill("3,600");
    await submit(a, a.locator('[data-line="Glow Works"]').getByRole("button", { name: "Save line" }));
    await a.getByText("Budget line saved.").waitFor();
    await b.locator('[data-line="Glow Works"]').getByLabel(/Planned/).fill("9,999");
    await b.locator('[data-line="Glow Works"]').getByRole("button", { name: "Save line" }).click();
    await b.getByText("changed by someone else").waitFor();
    await open(b, `${base}/budget`);
    assert(/HKD 3,600 /.test(await text(b.locator('[data-line="Glow Works"]'))), "first save lost");
    await a.close();
    await b.close();
  });

  // ------------------------------------------------------------------ over budget, filter, dashboard
  await step("over budget: a clear warning on the budget page and the dashboard, with negative remaining", async () => {
    await open(owner, `${base}/budget`);
    await addLine("Venue", "Marquee", { planned: "5,000", committed: "6,000" });
    await owner.getByText("Budget line added.").waitFor();
    // committed 5,700.50 + 6,000 = 11,700.50 against 10,000
    await owner.getByText("Over budget by HKD 1,700.50").first().waitFor();
    const t = await totalsText(owner);
    assert(/Remaining -HKD 1,700\.50/.test(t) && /Over budget\./.test(t), t);
    await open(owner, base);
    await owner.getByText("Over budget by HKD 1,700.50.").waitFor();
    await owner.getByRole("link", { name: "Review the budget" }).click();
    await owner.waitForURL(/\/budget$/);
  });
  await step("category filter narrows the table, shows labelled filtered totals, and leaves overall totals unchanged", async () => {
    const overall = await totalsText(owner);
    await open(owner, `${base}/budget?category=Decor`);
    assert((await owner.locator("[data-line]").count()) === 1, "filter should leave only the Decor line");
    const filtered = await totalsText(owner, "Filtered totals: Decor only");
    assert(/Committed HKD 3,200\.50/.test(filtered), filtered);
    assert((await totalsText(owner)) === overall, "overall totals changed when filtering");
    assert(/Total, Decor only/.test(await text(owner.locator("tfoot"))), "footer not labelled as filtered");
    await open(owner, `${base}/budget?category=Staffing`);
    await owner.getByText("No lines in Staffing").waitFor();
    await owner.getByRole("link", { name: "Clear filter" }).first().click();
    await owner.waitForURL(/\/budget$/);
    await owner.locator("[data-line]").first().waitFor();
    assert((await owner.locator("[data-line]").count()) === 3, "clear did not restore the lines");
  });
  await step("dashboard budget numbers equal the Budget page numbers", async () => {
    const t = await totalsText(owner);
    const num = (label, s) => new RegExp(`${label} (-?HKD [\\d,.]+)`).exec(s)?.[1];
    await open(owner, base);
    const d = await text(owner.locator("section[aria-labelledby=d-budget]"));
    assert(d.includes(num("Committed", t)), `committed differs: ${d} vs ${t}`);
    assert(d.includes(num("Paid", t)), "paid differs");
    assert(d.includes(num("Outstanding", t)), "outstanding differs");
    assert(/2 quotes accepted, 0 awaiting a decision\./.test(d), d); // Lantern is rejected, so nothing is awaiting
  });
  await step("deleting a manual line removes it from the totals", async () => {
    await open(owner, `${base}/budget`);
    await owner.locator('[data-line="Marquee"]').getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete line" }).click();
    await owner.getByText("Budget line deleted.").waitFor();
    assert(/Committed HKD 5,700\.50/.test(await totalsText(owner)), "total not restored");
    assert((await owner.getByText(/Over budget by/).count()) === 0, "warning still shown");
  });

  // ------------------------------------------------------------------ re-open and delete-linked-line
  await step("re-open keeps the line, unlinks it, makes committed editable, and the quote can be accepted into it again", async () => {
    await open(owner, `${base}/suppliers`);
    const row = owner.locator('[data-quote="Glow Works"]');
    await row.getByRole("button", { name: "Re-open" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Re-open quote" }).click();
    await owner.getByText("Quote re-opened.").waitFor();
    assert((await text(owner.locator('[data-quote="Glow Works"]'))).includes("Shortlisted"), "not shortlisted");
    await open(owner, `${base}/budget`);
    assert(/Entered by hand/.test(await text(owner.locator('[data-line="Glow Works"]'))), "line still tied to the quote");
    const before = await totalsText(owner);
    await open(owner, `${base}/suppliers`);
    const r2 = owner.locator('[data-quote="Glow Works"]');
    await r2.getByText("Accept…").click();
    await r2.getByLabel("Budget line").selectOption({ label: "Glow Works (Decor)" });
    await submit(owner, r2.getByRole("button", { name: "Accept quote" }));
    await owner.getByText("Quote accepted").waitFor();
    await open(owner, `${base}/budget`);
    assert((await owner.locator('[data-line="Glow Works"]').count()) === 1, "duplicate line after re-accept");
    assert((await totalsText(owner)) === before, "totals changed across re-open and re-accept");
  });
  await step("deleting a quote-linked line puts its quote back to Shortlisted", async () => {
    await open(owner, `${base}/budget`);
    await owner.locator('[data-line="Sound hire (manual)"]').getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete line" }).click();
    await owner.getByText("Budget line deleted.").waitFor();
    await open(owner, `${base}/suppliers`);
    assert((await text(owner.locator('[data-quote="Sound Crew"]'))).includes("Shortlisted"), "quote did not return to shortlisted");
  });

  await step("accepting into a line already paid more than the quote is refused; the line, the quote and the totals stay exactly as they were", async () => {
    await open(owner, `${base}/budget`);
    await addLine("Other", "Heavily paid", { committed: "1,000", paid: "900" });
    await owner.getByText("Budget line added.").waitFor();
    const lineBefore = await text(owner.locator('[data-line="Heavily paid"]'));
    const totalsBefore = await totalsText(owner);
    await open(owner, `${base}/suppliers`);
    await addQuote("Lantern Co", "800");
    await owner.getByText("Quote added.").waitFor();
    const fresh = () => owner.locator('[data-quote="Lantern Co"]').filter({ hasText: "HKD 800" });
    await fresh().getByText("Accept…").click();
    await fresh().getByLabel("Budget line").selectOption({ label: "Heavily paid (Other)" });
    await submit(owner, fresh().getByRole("button", { name: "Accept quote" }));
    await owner.getByText("already been paid more than this quote").waitFor();
    assert((await text(fresh())).includes("Requested"), "the quote changed status despite the refusal");
    await open(owner, `${base}/budget`);
    assert((await text(owner.locator('[data-line="Heavily paid"]'))) === lineBefore, "the budget line changed");
    assert((await totalsText(owner)) === totalsBefore, "totals changed after a refused accept");
    assert((await owner.locator('[data-line="Heavily paid"]').getByText("Entered by hand").count()) === 1, "line became linked");
    // clean up so later steps see the data they expect
    await owner.locator('[data-line="Heavily paid"]').getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete line" }).click();
    await owner.getByText("Budget line deleted.").waitFor();
    await open(owner, `${base}/suppliers`);
    await fresh().getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete quote" }).click();
    await owner.getByText("Quote deleted.").waitFor();
  });

  // ------------------------------------------------------------------ roles and isolation
  await step("organiser can manage; collaborator can read but has no add, edit, delete, accept or status controls", async () => {
    const o = A.organiser.page;
    await signIn(o, "organiser", `${base}/suppliers`);
    await o.locator('[data-quote="Sound Crew"]').getByText("Accept…").waitFor();
    await open(o, `${base}/budget`);
    await o.locator("section[aria-labelledby=add-h]").waitFor();

    const c = A.collab.page;
    await signIn(c, "collaborator", `${base}/suppliers`);
    await c.locator('[data-quote="Sound Crew"]').waitFor();
    for (const label of ["Accept…", "Edit quote", "Edit supplier", "Shortlist", "Reject"]) {
      assert((await c.getByText(label, { exact: true }).count()) === 0 && (await c.getByRole("button", { name: label }).count()) === 0, `${label} visible to a collaborator`);
    }
    assert((await c.getByRole("button", { name: "Delete" }).count()) === 0, "Delete visible");
    assert((await c.locator('form[aria-label="Add a supplier"]').count()) === 0, "add-supplier form visible");
    assert((await c.getByRole("heading", { name: "Add a quote" }).count()) === 0, "add-quote form visible");
    await open(c, `${base}/budget`);
    await c.locator("[data-line]").first().waitFor();
    assert((await c.locator("section[aria-labelledby=add-h]").count()) === 0, "add-line form visible");
    assert((await c.getByText("Edit line").count()) === 0, "Edit line visible");
    assert(/HKD 5,700\.50/.test(await totalsText(c)) || /Committed/.test(await totalsText(c)), "collaborator cannot read totals");
  });
  await step("an empty event with no target shows zeros and a hint, never NaN or 'over budget'", async () => {
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("Empty Fest");
    await owner.getByLabel("Starts").fill("2026-12-05T18:00");
    await owner.getByLabel("Ends").fill("2026-12-05T22:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\?m=created$/);
    ev2 = /\/events\/([0-9a-f-]{36})/.exec(owner.url())[1];
    await open(owner, `/w/${ws}/events/${ev2}/budget`);
    await owner.getByText("No budget target is set for this event").waitFor();
    const t = await totalsText(owner);
    assert(/Remaining Not set/.test(t) && !/NaN|Infinity/.test(t), t);
    assert((await owner.getByText(/Over budget by/).count()) === 0, "over-budget shown with no target");
    await addLine("Other", "Unplanned spend", { committed: "500" });
    await owner.getByText("Budget line added.").waitFor();
    assert((await owner.getByText(/Over budget by/).count()) === 0, "spending with no target must not read as over budget");
    await open(owner, `/w/${ws}/events/${ev2}`);
    const d = await text(owner.locator("section[aria-labelledby=d-budget]"));
    assert(/Remaining Not set/.test(d) && /Committed HKD 500/.test(d), d);
  });
  await step("budget data is scoped per event: the other event's lines and quotes do not leak", async () => {
    await open(owner, `/w/${ws}/events/${ev2}/budget`);
    assert((await owner.locator('[data-line="Glow Works"]').count()) === 0, "lines leaked across events");
    await open(owner, `/w/${ws}/events/${ev2}/suppliers`);
    assert((await owner.locator("[data-quote]").count()) === 0, "quotes leaked across events");
    await owner.locator('[data-supplier="Glow Works"]').waitFor(); // the directory itself is workspace-wide
  });
  await step("outsiders get 'Page not found' for the budget and supplier pages", async () => {
    const p = A.outsider.page;
    await signIn(p, "outsider");
    await p.getByLabel("Workspace name").fill("Outsider Co");
    await p.getByRole("button", { name: "Create workspace" }).click();
    await p.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    for (const path of [`${base}/budget`, `${base}/suppliers`]) await notFound(p, path);
  });
  await step("after sign-out and sign-in all budget data and totals are unchanged", async () => {
    await open(owner, `${base}/budget`);
    const t0 = await totalsText(owner);
    await owner.getByRole("button", { name: "Sign out" }).click();
    await owner.waitForURL((u) => u.pathname === "/");
    await signIn(owner, "owner", `${base}/budget`);
    assert((await totalsText(owner)) === t0, `totals changed after re-login: ${t0} -> ${await totalsText(owner)}`);
    // Only "Glow Works" remains: Marquee and "Sound hire (manual)" were deleted earlier in this run.
    assert((await owner.locator("[data-line]").count()) === 1, "budget lines changed after re-login");
  });
} finally {
  await browser.close();
}
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
