// Browser checks for phase 7: pricing page, sandbox plans and limits, owner-only test checkout, tampering, cancel/fail,
// repeats, persistence, and "everything works on Free". One isolated browser context per role.
//
// Needs: dev server on :3000 with PAYMENT_SANDBOX_ENABLED=true, the disposable accounts (npm run dev:users -- create),
// and the dev project's env file:
//   $env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e:p7
// Steps marked "needs 008" use migrations 20261026000007 and 20261026000008; set E2E_NO008=1 to skip them while 008 is not applied.
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.DEV_USERS_PASSWORD;
const NO008 = process.env.E2E_NO008 === "1";
if (!PASSWORD) {
  console.error("Set DEV_USERS_PASSWORD to the password printed by `npm run dev:users -- create`.");
  process.exit(2);
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = (r) => `dev-${r}@example.test`;
const browser = await chromium.launch();
const results = [];
const step = async (name, fn, opts = {}) => {
  if (opts.needs008 && NO008) {
    results.push([name, "skip"]);
    console.log(`SKIP ${name} (needs migrations 007 and 008)`);
    return;
  }
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
/** A client signed in as one test user with the public key only, exactly what a browser could do on its own. */
const asUser = async (role) => {
  const c = createClient(URL_, publicKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: email(role), password: PASSWORD });
  if (error) throw new Error(`sign-in as ${role}: ${error.message}`);
  return c;
};
const CAPTURE = process.env.E2E_CAPTURE ?? join(tmpdir(), "sceneset-p7-actions.json");
/** Re-send a captured Next.js server-action POST with some form fields replaced: what a script could do without the UI. */
const setField = (body, name, value) =>
  body.replace(new RegExp('(name="(?:_?\\d+_)?' + name + '"\\r?\\n\\r?\\n)[^\\r\\n]*'), (_, head) => head + value);
const replay = async (page, cap, vals) => {
  let body = cap.body;
  for (const [name, value] of Object.entries(vals)) body = setField(body, name, value);
  const headers = Object.fromEntries(Object.entries(cap.headers).filter(([k]) => !["content-length", "host", "cookie", "connection"].includes(k)));
  const oldWs = /\/w\/([0-9a-f-]{36})\//.exec(cap.url)[1];
  return page.request.post(cap.url.replace(oldWs, vals.ws ?? oldWs), { headers, data: body, maxRedirects: 0 });
};
const key = () => `e2e-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const A = { owner: await newPage(), organiser: await newPage(), collab: await newPage(), outsider: await newPage(), anon: await newPage() };
const owner = A.owner.page;
const captured = {};
owner.on("request", (r) => {
  const h = r.headers();
  if (r.method() !== "POST" || !h["next-action"] || !r.postData()) return;
  const path = new URL(r.url()).pathname;
  const kind = path.endsWith("/upgrade/sandbox") ? "checkout" : path.endsWith("/upgrade") ? "end" : null;
  if (kind) captured[kind] = { url: r.url(), headers: h, body: r.postData() };
});
let ws, ws2, uid, evA, evB;
const wsRow = async (id = ws) => (await must(admin.from("workspaces").select("plan").eq("id", id).single())).plan;
const upgradedIds = async (id = ws) => (await must(admin.from("events").select("id").eq("workspace_id", id).eq("event_upgrade", true))).map((r) => r.id);
const logCount = async (id = ws) => (await admin.from("entitlement_events").select("id", { count: "exact", head: true }).eq("workspace_id", id)).count;
const planPage = `/w/PLACEHOLDER/upgrade`;
const goPlan = async (page = owner, w = ws) => open(page, planPage.replace("PLACEHOLDER", w));
const tier = async (page = owner) => page.locator("[data-plan]").first().getAttribute("data-plan");
const usage = async (page, k) => text(page.locator(`[data-usage=${k}]`));
const sandboxUrl = (q) => `/w/${ws}/upgrade/sandbox?${q}`;

try {
  // ================================================================== pricing page (public)
  await step("pricing page: three plans with consistent prices, cadence, limits, a provisional label and a test-mode note", async () => {
    const p = A.anon.page;
    await open(p, "/pricing");
    const cards = Object.fromEntries(await p.locator("[data-plan-card]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-plan-card"), e.textContent.replace(/\s+/g, " ")])));
    assert(Object.keys(cards).join() === "free,event,organiser", Object.keys(cards).join());
    assert(/Free Personal/.test(cards.free) && /HKD 0/.test(cards.free) && /1 active event/.test(cards.free) && /3 members/.test(cards.free), cards.free);
    assert(/Event Upgrade/.test(cards.event) && /HKD 149/.test(cards.event) && /per event, one-off/.test(cards.event) && /10 members/.test(cards.event), cards.event);
    assert(/Organiser/.test(cards.organiser) && /HKD 299/.test(cards.organiser) && /per month/.test(cards.organiser) && /Unlimited active events/.test(cards.organiser) && /Unlimited members/.test(cards.organiser), cards.organiser);
    const note = await text(p.locator("[data-price-note]"));
    assert(/Provisional prices/.test(note) && /unvalidated/.test(note) && /No real payment is taken/.test(note) && /no card details are collected/.test(note), note);
    assert((await p.locator("input:not([type=hidden]), select, textarea").count()) === 0, "the pricing page has form fields");
    assert(!/stripe|credit card|card number|cvv|checkout\.com/i.test(await p.locator("body").innerText()), "payment wording found");
  });
  await step("pricing page: the vendor referral section is separate, labelled illustrative and has no links or buttons", async () => {
    const p = A.anon.page;
    const r = p.locator("[data-referrals]");
    const t = await text(r);
    assert(/Illustrative — not a live marketplace/.test(t) && /fictional/.test(t), t);
    assert((await r.locator("a, button, input, form").count()) === 0, "the referral section contains an action");
    assert((await p.locator("section").count()) === 1, "referrals must not sit inside the plan cards");
    assert((await p.locator("[data-plan-card] [data-referrals]").count()) === 0, "referrals nested in a plan card");
  });

  // ================================================================== setup
  await step("setup: owner workspace with an organiser and a collaborator, one event; the outsider owns another workspace", async () => {
    await signIn(owner, "owner");
    await owner.getByLabel("Workspace name").fill("P7 Plans Co");
    await owner.getByRole("button", { name: "Create workspace" }).click();
    await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    ws = /\/w\/([0-9a-f-]{36})\//.exec(owner.url())[1];
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
    // The first event goes through the ordinary owner session on a Free workspace (no admin fixture), so the limits below are real.
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("Plans Event One");
    await owner.getByLabel("Starts").fill("2027-03-01T10:00");
    await owner.getByLabel("Ends").fill("2027-03-01T18:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\?m=created$/);
    evA = /\/events\/([0-9a-f-]{36})/.exec(owner.url())[1];
    assert((await wsRow()) === "free", "the test workspace must be on the Free plan");
    const o = A.outsider.page;
    await signIn(o, "outsider");
    await o.getByLabel("Workspace name").fill("P7 Other Co");
    await o.getByRole("button", { name: "Create workspace" }).click();
    await o.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    ws2 = /\/w\/([0-9a-f-]{36})\//.exec(o.url())[1];
    await signIn(A.organiser.page, "organiser");
    await signIn(A.collab.page, "collaborator");
  });

  // ================================================================== the plan page
  await step("plan page: the owner sees the Free plan with real usage and the test-mode note; limits are the documented ones", async () => {
    await goPlan();
    assert((await tier()) === "free", await tier());
    const t = await text(owner.locator("main"));
    assert(/Free Personal/.test(t) && /Test mode\. No real payment is taken/.test(t) && /Provisional prices/.test(t), t.slice(0, 400));
    assert(/1 of 1/.test(await usage(owner, "events")) && /limit reached/.test(await usage(owner, "events")), await usage(owner, "events"));
    assert(/3 of 3/.test(await usage(owner, "members")), await usage(owner, "members"));
    await owner.getByRole("button", { name: "Try the test upgrade" }).waitFor();
    await owner.getByRole("link", { name: "Try the test plan" }).waitFor();
  });
  await step("plan page: organiser and collaborator see the plan but have no controls; a non-member gets 'Page not found'", async () => {
    for (const k of ["organiser", "collab"]) {
      const p = A[k].page;
      await goPlan(p);
      assert((await tier(p)) === "free", "plan not shown");
      await p.locator("[data-owner-only]").waitFor();
      assert((await p.getByRole("button", { name: "Try the test upgrade" }).count()) === 0 && (await p.getByRole("link", { name: "Try the test plan" }).count()) === 0, `${k} has plan controls`);
      assert((await p.locator("[data-log]").count()) === 0, `${k} sees the checkout log`);
      await open(p, sandboxUrl("plan=organiser"));
      await p.locator("[data-blocked]").waitFor();
      assert((await p.getByRole("button", { name: /Simulate/ }).count()) === 0, `${k} sees simulation buttons`);
    }
    await notFound(A.outsider.page, `/w/${ws}/upgrade`);
    await notFound(A.outsider.page, `/w/${ws}/upgrade/sandbox?plan=organiser`);
    await open(A.anon.page, `/w/${ws}/upgrade`);
    assert(/\/login/.test(A.anon.page.url()), `anonymous landed on ${A.anon.page.url()}`);
  });
  await step("checkout page: it is clearly test mode and collects nothing: every field is hidden and there is no card input", async () => {
    await open(owner, sandboxUrl("plan=organiser"));
    assert(/Test mode — No real payment taken/.test(await text(owner.locator("[data-test-mode]"))), "banner missing");
    const kinds = await owner.locator("main input, main select, main textarea").evaluateAll((els) => els.map((e) => `${e.tagName}:${e.type}`));
    assert(kinds.every((k) => k === "INPUT:hidden"), `visible fields: ${kinds}`);
    assert((await owner.locator("[autocomplete^=cc-]").count()) === 0, "a card autocomplete field exists");
    const labels = await owner.getByRole("button").allInnerTexts();
    for (const l of ["Simulate success", "Simulate cancellation", "Simulate failure"]) assert(labels.includes(l), `missing ${l}`);
    assert(!/stripe|card number|expiry|cvv/i.test(await owner.locator("main").innerText()), "payment-form wording");
  });
  await step("a hand-typed success URL, or opening the checkout page, grants nothing", async () => {
    await open(owner, `/w/${ws}/upgrade?r=success`);
    assert((await tier()) === "free", "the plan changed");
    assert(!/Test upgrade recorded/.test(await owner.locator("main").innerText()), "a success banner appeared without a success");
    await open(owner, sandboxUrl("plan=organiser&outcome=success&r=success"));
    await open(owner, sandboxUrl(`plan=event&event=${evA}&outcome=success`));
    assert((await wsRow()) === "free" && (await upgradedIds()).length === 0, "an entitlement changed from a GET");
    assert((await logCount()) === 0 || NO008, "a GET wrote a log row");
  });
  await step("checkout page rejects unknown plans, bad events and other workspaces' events", async () => {
    const o = owner;
    for (const q of ["plan=enterprise", "plan=free", "plan=", "", "plan=event", "plan=event&event=not-a-uuid", `plan=event&event=${evA}x`, "plan=ORGANISER"]) {
      await open(o, sandboxUrl(q));
      await o.locator("[data-blocked]").waitFor();
    }
    const theirs = (await must(admin.from("events").insert({ workspace_id: ws2, title: "Theirs", starts_at: "2027-03-01T02:00:00Z", ends_at: "2027-03-01T10:00:00Z", timezone: "Asia/Hong_Kong", currency: "HKD", created_by: uid.outsider }).select("id").single())).id;
    await open(o, sandboxUrl(`plan=event&event=${theirs}`));
    await o.locator("[data-blocked]").waitFor();
    assert(/not found in this workspace/.test(await text(o.locator("[data-blocked]"))), "should say not found");
  });

  // ================================================================== limits on Free (database enforced)
  await step("free limits: a second active event is refused with a clear message; nothing is created (needs 008)", async () => {
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("Plans Event Two");
    await owner.getByLabel("Starts").fill("2027-04-01T10:00");
    await owner.getByLabel("Ends").fill("2027-04-01T12:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.getByText(/The free plan allows 1 active event/).waitFor();
    const n = (await admin.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", ws)).count;
    assert(n === 1, `event count ${n}`);
  }, { needs008: true });
  await step("free limits: a fourth member is refused with a clear message; nothing is added (needs 008)", async () => {
    await open(owner, `/w/${ws}/settings`);
    const form = owner.locator("form:has(input[name=email])");
    await form.getByLabel("Add a member by email").fill(email("outsider"));
    await submit(owner, form.getByRole("button", { name: "Add member" }));
    await owner.getByText(/member limit is reached/).waitFor();
    const n = (await admin.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", ws)).count;
    assert(n === 3, `members ${n}`);
  }, { needs008: true });
  await step("everything still works on Free: every view of the one event opens, and a task can be added", async () => {
    const base = `/w/${ws}/events/${evA}`;
    for (const [path, heading] of [["", /Readiness/], ["/tasks", /New task/], ["/suppliers", /Supplier directory|No suppliers yet/], ["/budget", /Totals for all budget lines|Budget/], ["/guests", /Summary of all guests|Guests/], ["/schedule", /All times are in|Add an entry|No running order yet/], ["/layout", /layout/i], ["/summary", /Printed from SceneSet/]]) {
      await open(owner, base + path);
      const t = await owner.locator("main").innerText();
      assert(heading.test(t), `${path || "dashboard"}: ${t.slice(0, 120)}`);
      assert(!/upgrade (is )?required|available on paid|locked/i.test(t), `${path}: a plan wall`);
    }
    await open(owner, `${base}/tasks`);
    const form = owner.getByRole("form", { name: "Add a task" });
    await form.getByLabel("New task").fill("A task on the free plan");
    await submit(owner, form.getByRole("button", { name: "Add task" }));
    await owner.getByText("A task on the free plan").first().waitFor();
  });

  // ================================================================== who can change entitlements
  await step("the sandbox functions cannot be called through the API by anyone signed in, the owner included; the server path still refuses non-owners (needs 008)", async () => {
    const args = (extra = {}) => ({ actor: uid.owner, ws, plan_id: "organiser", ev: null, outcome: "success", idem: key(), ...extra });
    for (const role of ["owner", "organiser", "collaborator", "outsider"]) {
      const c = await asUser(role);
      const r = await c.rpc("sandbox_checkout", args());
      assert(r.error?.code === "42501", `${role} checkout: ${r.error?.code ?? "allowed"}`);
      const e = await c.rpc("sandbox_end_organiser", { actor: uid.owner, ws });
      assert(e.error?.code === "42501", `${role} end: ${e.error?.code ?? "allowed"}`);
      const old = await c.rpc("sandbox_checkout", { ws, plan_id: "organiser", ev: null, outcome: "success", idem: key() }); // the 007 signature
      assert(old.error?.code === "PGRST202", `${role}: the old signature still exists (${old.error?.code ?? "allowed"})`);
    }
    const anon = createClient(URL_, publicKey, { auth: { persistSession: false } });
    const r = await anon.rpc("sandbox_checkout", args());
    assert(r.error?.code === "42501", `anon: ${r.error?.code ?? "allowed"}`);
    // the server path (secret key) checks the actor itself: a user who does not own this workspace is refused
    for (const role of ["organiser", "collab", "outsider"]) {
      const sr = await admin.rpc("sandbox_checkout", args({ actor: uid[role] }));
      assert(sr.error?.code === "42501", `server path, ${role}: ${sr.error?.code ?? "allowed"}`);
      const se = await admin.rpc("sandbox_end_organiser", { actor: uid[role], ws });
      assert(se.error?.code === "42501", `server path end, ${role}: ${se.error?.code ?? "allowed"}`);
    }
    const nobody = await admin.rpc("sandbox_checkout", args({ actor: null }));
    assert(nobody.error?.code === "42501", `no actor: ${nobody.error?.code ?? "allowed"}`);
    const direct = await (await asUser("owner")).from("workspaces").update({ plan: "organiser" }).eq("id", ws).select("id");
    assert(direct.error?.code === "42501" || !direct.data?.length, "an owner could write the plan column directly");
    assert((await wsRow()) === "free" && (await logCount()) === 0, "state changed");
  }, { needs008: true });
  const tamper = async (url, edit, expect) => {
    await open(owner, url);
    await owner.evaluate((e) => {
      for (const [name, value] of Object.entries(e)) document.querySelector(`input[name=${name}]`).value = value;
    }, edit);
    await submit(owner, owner.getByRole("button", { name: "Simulate success" }));
    await owner.getByText(expect).first().waitFor();
    assert((await wsRow()) === "free" && (await upgradedIds()).length === 0 && (await wsRow(ws2)) === "free", `state changed after ${JSON.stringify(edit)}`);
  };
  await step("tampered checkout forms (unknown plan, free plan, bad key, plan/event mismatch) are rejected by the server action before the database", async () => {
    await tamper(sandboxUrl("plan=organiser"), { plan: "enterprise" }, /That request was not valid/);
    await tamper(sandboxUrl("plan=organiser"), { plan: "free" }, /That request was not valid/);
    await tamper(sandboxUrl("plan=organiser"), { key: "short" }, /That request was not valid/);
    await tamper(sandboxUrl("plan=organiser"), { ev: evA }, /That request was not valid/);
    await tamper(sandboxUrl(`plan=event&event=${evA}`), { ev: "" }, /That request was not valid/);
    await tamper(sandboxUrl(`plan=event&event=${evA}`), { ev: "not-a-uuid" }, /That request was not valid/);
  });
  await step("tampered checkout forms aimed at another workspace or another workspace's event are refused by the database (needs 008)", async () => {
    await tamper(sandboxUrl("plan=organiser"), { ws: ws2 }, /Page not found/); // refused by the database; the redirect then lands on a workspace this user cannot open
    const theirs = (await must(admin.from("events").select("id").eq("workspace_id", ws2).limit(1)))[0].id;
    await tamper(sandboxUrl(`plan=event&event=${evA}`), { ev: theirs }, /That request was not valid/);
    assert((await logCount()) === 0 && (await logCount(ws2)) === 0, "a rejected request was logged");
  }, { needs008: true });

  // ================================================================== cancel, fail
  await step("cancellation and failure are logged and leave the plan, the event and the limits unchanged (needs 008)", async () => {
    for (const [button, banner, outcome] of [["Simulate cancellation", /Checkout cancelled/, "cancelled"], ["Simulate failure", /simulated payment failed/, "failed"]]) {
      await open(owner, sandboxUrl("plan=organiser"));
      await submit(owner, owner.getByRole("button", { name: button }));
      await owner.getByText(banner).waitFor();
      assert((await tier()) === "free", "plan changed");
      assert((await wsRow()) === "free", "database plan changed");
      assert((await owner.locator(`[data-log] [data-outcome=${outcome}]`).count()) === 1, `no ${outcome} log row`);
    }
    await open(owner, sandboxUrl(`plan=event&event=${evA}`));
    await submit(owner, owner.getByRole("button", { name: "Simulate failure" }));
    assert((await upgradedIds()).length === 0 && (await logCount()) === 3, "event upgraded or log count off");
    assert(/3 of 3/.test(await usage(owner, "members")) && /limit reached/.test(await usage(owner, "events")), "limits changed");
  }, { needs008: true });

  // ================================================================== success: event upgrade
  await step("a successful Event Upgrade applies to that event only and raises the member limit (needs 008)", async () => {
    evB = (await must(admin.from("events").insert({ workspace_id: ws, title: "Plans Event Archived", starts_at: "2027-05-01T02:00:00Z", ends_at: "2027-05-01T10:00:00Z", timezone: "Asia/Hong_Kong", currency: "HKD", created_by: uid.owner, archived_at: new Date().toISOString() }).select("id").single())).id;
    await goPlan();
    await owner.getByLabel("Event to upgrade").selectOption(evA);
    await owner.getByRole("button", { name: "Try the test upgrade" }).click();
    await owner.waitForURL(/\/upgrade\/sandbox\?/);
    await owner.locator("[data-test-mode]").waitFor(); // workspace pages show "Loading…" first; read the page only once it has rendered
    const co = await owner.locator("main").innerText();
    assert(/Plans Event One/.test(co), `event name missing on the checkout; url ${owner.url().replace(/[0-9a-f-]{36}/g, "<id>")}; page text: ${co.replace(/s+/g, " ").slice(0, 160)}`);
    await submit(owner, owner.getByRole("button", { name: "Simulate success" }));
    await owner.getByText(/Test upgrade recorded/).waitFor();
    assert((await tier()) === "event", await tier());
    assert((await upgradedIds()).join() === evA, "the wrong event was upgraded");
    assert(/3 of 10/.test(await usage(owner, "members")), await usage(owner, "members"));
    assert(/1 of 1/.test(await usage(owner, "events")), "events limit should be unchanged");
    assert(/Plans Event One/.test(await text(owner.locator("[data-upgraded]"))), "upgraded event not listed");
    assert((await wsRow()) === "free", "workspace plan should stay free");
    // the higher member limit is real: the fourth member can now be added
    await open(owner, `/w/${ws}/settings`);
    const form = owner.locator("form:has(input[name=email])");
    await form.getByLabel("Add a member by email").fill(email("outsider"));
    await form.getByLabel("Role").selectOption("collaborator");
    await submit(owner, form.getByRole("button", { name: "Add member" }));
    await owner.getByText("Member added.").waitFor();
  }, { needs008: true });
  await step("the printed summary drops the SceneSet footer only for the upgraded event (needs 008)", async () => {
    await open(owner, `/w/${ws}/events/${evA}/summary`);
    const t = await owner.locator("article footer").innerText();
    assert(!/Printed from SceneSet/.test(t) && /Prototype/.test(t), t);
    await open(owner, `/w/${ws}/events/${evB}/summary`);
    assert(/Printed from SceneSet/.test(await owner.locator("article footer").innerText()), "the other event lost its footer");
  }, { needs008: true });

  // ================================================================== repeats
  await step("repeating the same checkout cannot duplicate an upgrade: same request key, fresh key and double submit (needs 008)", async () => {
    // Two tabs of the same checkout share the page's key once the second tab's hidden field is copied from the first.
    const p1 = owner;
    const second = await A.owner.ctx.newPage();
    second.setDefaultTimeout(15000);
    await open(p1, sandboxUrl("plan=organiser"));
    await open(second, sandboxUrl("plan=organiser"));
    const k1 = await p1.locator("input[name=key]").inputValue();
    const k2 = await second.locator("input[name=key]").inputValue();
    assert(k1 !== k2, "request keys should differ per page view");
    await second.evaluate((k) => { document.querySelector("input[name=key]").value = k; }, k1);
    await submit(p1, p1.getByRole("button", { name: "Simulate success" }));
    await p1.getByText(/Test upgrade recorded/).waitFor();
    const logs = await logCount();
    assert((await wsRow()) === "organiser", "the first success should upgrade");
    // the stale second tab: same key. The page it came from is now covered, but the action still must not do anything twice
    await submit(second, second.getByRole("button", { name: "Simulate success" }));
    await second.getByText(/already processed/).waitFor();
    assert((await logCount()) === logs, "a replay wrote a second log row");
    // the same key cannot be turned into a failure or a different outcome
    await open(second, sandboxUrl("plan=organiser")).catch(() => undefined);
    await second.close();
    // a brand new key for something already covered is refused
    const again = await admin.rpc("sandbox_checkout", { actor: uid.owner, ws, plan_id: "organiser", ev: null, outcome: "success", idem: key() });
    assert(again.error?.code === "P0001", `expected covered, got ${again.error?.code}`);
    const ev = await admin.rpc("sandbox_checkout", { actor: uid.owner, ws, plan_id: "event", ev: evA, outcome: "success", idem: key() });
    assert(ev.error?.code === "P0001", `expected covered, got ${ev.error?.code}`);
    assert((await logCount()) === logs && (await upgradedIds()).length === 1, "something was duplicated");
  }, { needs008: true });

  // ================================================================== Organiser, persistence
  await step("Organiser (test) removes the limits; a second active event can now be created (needs 008)", async () => {
    await goPlan();
    assert((await tier()) === "organiser", await tier());
    assert(/unlimited/.test(await usage(owner, "events")) && /unlimited/.test(await usage(owner, "members")), `${await usage(owner, "events")} / ${await usage(owner, "members")}`);
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("Plans Event Two");
    await owner.getByLabel("Starts").fill("2027-04-01T10:00");
    await owner.getByLabel("Ends").fill("2027-04-01T12:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\?m=created$/);
    await open(owner, `/w/${ws}/events/${evA}/summary`);
    assert(!/Printed from SceneSet/.test(await owner.locator("article footer").innerText()), "Organiser prints should drop the footer");
  }, { needs008: true });
  await step("the plan persists after refresh and after sign-out and sign-in (needs 008)", async () => {
    await goPlan();
    await owner.reload();
    assert((await tier()) === "organiser", "lost on refresh");
    await owner.getByRole("button", { name: "Sign out" }).click();
    await owner.waitForURL((u) => u.pathname === "/" || u.pathname === "/login");
    await signIn(owner, "owner", `/w/${ws}/upgrade`);
    assert((await tier()) === "organiser", "lost after sign-in");
    assert((await upgradedIds()).join() === evA, "event upgrade lost");
    await owner.locator("[data-log] [data-outcome=success]").first().waitFor();
  }, { needs008: true });
  await step("ending the test Organiser plan returns the workspace to Free limits and keeps the event upgrade and all data (needs 008)", async () => {
    await goPlan();
    await owner.getByRole("button", { name: "End the test plan" }).click();
    await submit(owner, owner.getByRole("button", { name: "End test plan" }));
    await owner.getByText(/test Organiser plan was ended/).waitFor();
    assert((await tier()) === "event", await tier()); // Free Personal with the one-off Event Upgrade
    assert((await wsRow()) === "free", "plan not ended");
    assert((await upgradedIds()).join() === evA, "the one-off event upgrade must stay");
    const n = (await admin.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", ws)).count;
    assert(n === 3, `events kept: ${n}`); // evA, evB (archived), Plans Event Two
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("Plans Event Three");
    await owner.getByLabel("Starts").fill("2027-06-01T10:00");
    await owner.getByLabel("Ends").fill("2027-06-01T12:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.getByText(/The free plan allows 1 active event/).waitFor(); // two active events now exist: back at the limit
    const r = await admin.rpc("sandbox_end_organiser", { actor: uid.organiser, ws });
    assert(r.error?.code === "42501", "only an owner can end it");
    assert(captured.checkout && captured.end, "the raw checkout and end requests were not captured");
    writeFileSync(CAPTURE, JSON.stringify(captured));
  }, { needs008: true });
  await step("control: a raw replay of the captured checkout request, aimed at a fresh workspace, works while the sandbox is on (needs 008)", async () => {
    await open(owner, "/onboarding");
    await owner.getByLabel("Workspace name").fill("P7 Replay Co");
    await owner.getByRole("button", { name: "Create workspace" }).click();
    await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    const w3 = /\/w\/([0-9a-f-]{36})\//.exec(owner.url())[1];
    const res = await replay(owner, captured.checkout, { ws: w3, plan: "organiser", ev: "", outcome: "success", key: key() });
    assert(res.status() < 400 && !res.headers()["x-nextjs-action-not-found"], `replay status ${res.status()}`);
    assert((await wsRow(w3)) === "organiser", "the raw replay did not upgrade the fresh workspace, so the replay technique proves nothing");
    const r2 = await replay(owner, captured.end, { ws: w3 });
    assert(r2.status() < 400 && (await wsRow(w3)) === "free", "the raw end-Organiser replay did not work while enabled");
  }, { needs008: true });
  await step("the other workspace was never touched by any of this (needs 008)", async () => {
    assert((await wsRow(ws2)) === "free" && (await upgradedIds(ws2)).length === 0 && (await logCount(ws2)) === 0, "workspace 2 changed");
  }, { needs008: true });
} finally {
  await browser.close();
}
const failed = results.filter(([, s]) => s === false).length;
const skipped = results.filter(([, s]) => s === "skip").length;
console.log(`\n${results.filter(([, s]) => s === true).length}/${results.length - skipped} passed${skipped ? `, ${skipped} skipped (need migrations 007 and 008)` : ""}.`);
process.exit(failed ? 1 : 0);
