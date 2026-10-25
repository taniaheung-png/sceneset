// Phase 7, sandbox switched OFF. Run against a dev server started with PAYMENT_SANDBOX_ENABLED=false, after
// `npm run test:e2e:p7` has run once (it saves the raw checkout and end-Organiser requests its real forms made):
//   $env:PAYMENT_SANDBOX_ENABLED = "false"; npm run dev          (a fresh server)
//   $env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e:p7:off
// Every refusal is checked three ways: the UI offers nothing, a raw replay of the real request is refused, and the plan and
// the checkout log are unchanged. Direct database calls with the owner's own session are refused as well (migration 008).
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.DEV_USERS_PASSWORD;
if (!PASSWORD) {
  console.error("Set DEV_USERS_PASSWORD to the password printed by `npm run dev:users -- create`.");
  process.exit(2);
}
const CAPTURE = process.env.E2E_CAPTURE ?? join(tmpdir(), "sceneset-p7-actions.json");
let captured;
try {
  captured = JSON.parse(readFileSync(CAPTURE, "utf8"));
} catch {
  console.error(`No captured requests at ${CAPTURE}. Run \`npm run test:e2e:p7\` first (with the sandbox ON).`);
  process.exit(2);
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const open = async (page, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
};
const must = async (q) => {
  const r = await q;
  if (r.error) throw new Error(`seed failed: ${r.error.message}`);
  return r.data;
};
const setField = (body, name, value) =>
  body.replace(new RegExp('(name="(?:_?\\d+_)?' + name + '"\\r?\\n\\r?\\n)[^\\r\\n]*'), (_, head) => head + value);
const replay = async (page, cap, vals) => {
  let body = cap.body;
  for (const [name, value] of Object.entries(vals)) body = setField(body, name, value);
  const headers = Object.fromEntries(Object.entries(cap.headers).filter(([k]) => !["content-length", "host", "cookie", "connection"].includes(k)));
  const oldWs = /\/w\/([0-9a-f-]{36})\//.exec(cap.url)[1];
  return page.request.post(cap.url.replace(oldWs, vals.ws ?? oldWs), { headers, data: body, maxRedirects: 0 });
};
const key = () => `off-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const asUser = async (role) => {
  const c = createClient(URL_, publicKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: email(role), password: PASSWORD });
  if (error) throw new Error(`sign-in as ${role}: ${error.message}`);
  return c;
};

const ctx = await browser.newContext({ baseURL: BASE });
const owner = await ctx.newPage();
owner.setDefaultTimeout(15000);
let freeWs, orgWs, freeEv, ownerId;
const plan = async (w) => (await must(admin.from("workspaces").select("plan").eq("id", w).single())).plan;
const logs = async (w) => (await admin.from("entitlement_events").select("id", { count: "exact", head: true }).eq("workspace_id", w)).count;
const upgraded = async (w) => (await must(admin.from("events").select("id").eq("workspace_id", w).eq("event_upgrade", true))).length;
const unchanged = async (why) => {
  assert((await plan(freeWs)) === "free" && (await upgraded(freeWs)) === 0 && (await logs(freeWs)) === 0, `the Free workspace changed (${why})`);
  assert((await plan(orgWs)) === "organiser" && (await logs(orgWs)) === 0, `the Organiser workspace changed (${why})`);
};
const refused = (res) => {
  // The request may be answered with a redirect payload or a plain page; what matters is that the server knew the action
  // (so the refusal comes from the switch, not from a stale id) and that nothing changed.
  assert(!res.headers()["x-nextjs-action-not-found"] && res.status() !== 404, `the server did not recognise the captured action (status ${res.status()}): the replay proves nothing`);
};

try {
  await step("setup: a Free workspace with its first event, and an Organiser workspace (admin fixture); the server is really switched off", async () => {
    await open(owner, "/login");
    await owner.getByLabel("Email").fill(email("owner"));
    await owner.getByLabel("Password").fill(PASSWORD);
    await owner.getByRole("button", { name: "Sign in" }).click();
    await owner.waitForURL((u) => !["/login", "/app"].includes(u.pathname));
    for (const name of ["P7 Off Co", "P7 Off Organiser Co"]) {
      await open(owner, "/onboarding");
      await owner.getByLabel("Workspace name").fill(name);
      await owner.getByRole("button", { name: "Create workspace" }).click();
      await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
      const w = /\/w\/([0-9a-f-]{36})\//.exec(owner.url())[1];
      if (name === "P7 Off Co") freeWs = w;
      else orgWs = w;
    }
    ownerId = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === email("owner")).id;
    await open(owner, `/w/${freeWs}/events/new`);
    await owner.getByLabel("Event title").fill("Off Event");
    await owner.getByLabel("Starts").fill("2027-03-01T10:00");
    await owner.getByLabel("Ends").fill("2027-03-01T18:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\?m=created$/);
    freeEv = /\/events\/([0-9a-f-]{36})/.exec(owner.url())[1];
    await must(admin.from("workspaces").update({ plan: "organiser" }).eq("id", orgWs).select("id"));
    await open(owner, `/w/${freeWs}/upgrade`);
    assert(/switched off on this server/.test(await owner.locator("main").innerText()), "the server is not running with PAYMENT_SANDBOX_ENABLED=false");
    await unchanged("setup");
  });
  await step("UI: the owner sees no way to upgrade or end a plan, and the checkout page says it is switched off", async () => {
    await open(owner, `/w/${freeWs}/upgrade`);
    for (const label of [/Try the test upgrade/, /Try the test plan/]) assert((await owner.getByRole("button", { name: label }).count()) + (await owner.getByRole("link", { name: label }).count()) === 0, `a control is visible: ${label}`);
    await open(owner, `/w/${freeWs}/upgrade/sandbox?plan=organiser`);
    assert(/switched off/.test(await owner.locator("[data-blocked]").innerText()), "no switched-off message");
    assert((await owner.getByRole("button", { name: /Simulate/ }).count()) === 0, "simulation buttons are visible");
    await open(owner, `/w/${freeWs}/upgrade/sandbox?plan=event&event=${freeEv}`);
    assert((await owner.getByRole("button", { name: /Simulate/ }).count()) === 0, "simulation buttons are visible for the event plan");
    await open(owner, `/w/${orgWs}/upgrade`);
    assert((await owner.getByRole("button", { name: /End the test plan/ }).count()) === 0, "the end-plan control is visible");
    await unchanged("UI");
  });
  await step("direct requests: replaying the real checkout request (success, cancel, failure) is refused and writes nothing", async () => {
    for (const outcome of ["success", "cancelled", "failed"]) {
      const res = await replay(owner, captured.checkout, { ws: freeWs, plan: "organiser", ev: "", outcome, key: key() });
      refused(res);
      await unchanged(`checkout replay, ${outcome}`);
    }
    const res = await replay(owner, captured.checkout, { ws: freeWs, plan: "event", ev: freeEv, outcome: "success", key: key() });
    refused(res);
    await unchanged("event upgrade replay");
  });
  await step("direct requests: replaying the real end-Organiser request is refused and the Organiser workspace stays Organiser", async () => {
    const res = await replay(owner, captured.end, { ws: orgWs });
    refused(res);
    await unchanged("end replay");
  });
  await step("direct requests: the captured requests are well formed (the main suite's control step shows the same replay does work while the sandbox is on)", async () => {
    // Not a second proof of the switch: it checks the replayed request is well formed, so the refusals above are the switch and nothing else.
    assert(/name="(?:_?\d+_)?key"/.test(captured.checkout.body) && /name="(?:_?\d+_)?plan"/.test(captured.checkout.body) && /name="(?:_?\d+_)?ws"/.test(captured.end.body), "the captured bodies are missing their fields");
  });
  await step("database: the owner's own session cannot call the sandbox functions to get around the switch", async () => {
    const c = await asUser("owner");
    for (const [name, call] of [
      ["checkout", () => c.rpc("sandbox_checkout", { actor: ownerId, ws: freeWs, plan_id: "organiser", ev: null, outcome: "success", idem: key() + "-0123456789" })],
      ["event checkout", () => c.rpc("sandbox_checkout", { actor: ownerId, ws: freeWs, plan_id: "event", ev: freeEv, outcome: "success", idem: key() + "-0123456789" })],
      ["end", () => c.rpc("sandbox_end_organiser", { actor: ownerId, ws: orgWs })],
    ]) {
      const r = await call();
      assert(r.error?.code === "42501", `${name}: ${r.error?.code ?? "allowed"}`);
    }
    const w = await c.from("workspaces").update({ plan: "organiser" }).eq("id", freeWs).select("id");
    assert(w.error?.code === "42501" || !w.data?.length, "the plan column is writable");
    const e = await c.from("events").update({ event_upgrade: true }).eq("id", freeEv).select("id");
    assert(e.error?.code === "42501" || !e.data?.length, "event_upgrade is writable");
    await unchanged("database");
  });
  await step("the Free workspace still works: its single event opens, and everything stays free", async () => {
    await open(owner, `/w/${freeWs}/events/${freeEv}/summary`);
    assert(/Printed from SceneSet/.test(await owner.locator("article footer").innerText()), "summary footer");
    await open(owner, `/w/${freeWs}/events/new`);
    await owner.getByLabel("Event title").fill("Second event");
    await owner.getByLabel("Starts").fill("2027-04-01T10:00");
    await owner.getByLabel("Ends").fill("2027-04-01T12:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.getByText(/The free plan allows 1 active event/).waitFor();
  });
} finally {
  await browser.close();
}
const failed = results.filter(([, s]) => s === false).length;
console.log(`\n${results.filter(([, s]) => s === true).length}/${results.length} passed.`);
process.exit(failed ? 1 : 0);
