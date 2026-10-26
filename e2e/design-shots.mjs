// Visual-review screenshots of the real app with believable fictional data (not a mock-up: every page is the working page),
// including empty, validation, permission-restricted, dialog, error and phone-drawer states.
// Usage (dev server on :3000, fresh accounts from `npm run dev:users -- create`):
//   $env:DEV_USERS_PASSWORD = "<printed password>"; node --env-file=.env.local e2e/design-shots.mjs <tag>
// <tag> is a folder name under docs/design (for example "before" or "after"). Fixtures are created through the service key
// into throw-away workspaces owned by the disposable accounts and removed by `npm run dev:users -- delete`.
// Optional env: SHOT_WIDTHS=1440,375  SHOTS_ONLY=name1,name2  (reuse the fixtures of an earlier run when they still exist)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TAG = process.argv[2] ?? "after";
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.DEV_USERS_PASSWORD;
if (!PASSWORD) {
  console.error("Set DEV_USERS_PASSWORD to the password printed by `npm run dev:users -- create`.");
  process.exit(2);
}
const DIR = join("docs", "design", TAG);
mkdirSync(DIR, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = async (q) => {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const widths = (process.env.SHOT_WIDTHS ?? "1440,375,768,1024").split(",").map(Number);
const only = process.env.SHOTS_ONLY ? process.env.SHOTS_ONLY.split(",") : null;
const want = (n) => !only || only.includes(n);

const browser = await chromium.launch();
const login = async (role) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.goto("/login");
  await page.getByLabel("Email").fill(`dev-${role}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !["/login", "/app"].includes(u.pathname));
  await page.waitForLoadState("networkidle");
  return page;
};
const open = async (page, p) => {
  await page.goto(p);
  await page.waitForLoadState("networkidle");
};
const users = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users;
const uid = (r) => users.find((u) => u.email === `dev-${r}@example.test`).id;

const page = await login("owner");
const owner = uid("owner");
let ws, ev, mixer, emptyWs, emptyEv;
const existing = (await admin.from("workspaces").select("id").eq("name", "Studio Society").limit(1)).data?.[0];
const existingEmpty = (await admin.from("workspaces").select("id").eq("name", "Empty Studio").limit(1)).data?.[0];
if (existing && existingEmpty) {
  ws = existing.id;
  ev = (await must(admin.from("events").select("id").eq("workspace_id", ws).eq("demo", true).limit(1)))[0].id;
  mixer = (await must(admin.from("events").select("id").eq("workspace_id", ws).eq("title", "Autumn Society Mixer").limit(1)))[0].id;
  emptyWs = existingEmpty.id;
  emptyEv = (await must(admin.from("events").select("id").eq("workspace_id", emptyWs).limit(1)))[0].id;
} else {
  await page.getByLabel("Workspace name").fill("Studio Society");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
  ws = /\/w\/([0-9a-f-]{36})\//.exec(page.url())[1];
  await must(admin.from("workspaces").update({ plan: "organiser" }).eq("id", ws).select("id"));
  await page.getByRole("button", { name: "Load a sample event" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}\?m=sample/);
  ev = /\/events\/([0-9a-f-]{36})/.exec(page.url())[1];
  const venue = (await must(admin.from("venues").insert({ workspace_id: ws, name: "The Glasshouse", width_cm: 1800, depth_cm: 1200 }).select("id").single())).id;
  const mk = async (workspace, title, status, start, extra = {}) =>
    must(admin.from("events").insert({ workspace_id: workspace, title, status, starts_at: start, ends_at: new Date(Date.parse(start) + 4 * 3600e3).toISOString(), timezone: "Asia/Hong_Kong", currency: "HKD", created_by: owner, ...extra }).select("id").single());
  const soon = (d) => new Date(Date.now() + d * 86400e3).toISOString();
  const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
  const full = { venue_id: venue, capacity: 120, budget_target_minor: 4_000_000, goals: "A warm evening with local food and good music." };
  mixer = (await mk(ws, "Autumn Society Mixer", "planning", soon(4), full)).id;
  await mk(ws, "Community Makers Market", "confirmed", soon(12), full);
  await mk(ws, "Winter Welcome Showcase", "planning", soon(26), full);
  for (const [t, due, st] of [["Collect final audio quote", day(1), "in_progress"], ["Confirm the food-truck menu", day(2), "in_progress"], ["Share the mixer poster", day(3), "todo"], ["Confirm venue access window", day(7), "todo"], ["Draft the volunteer welcome note", day(-2), "done"]]) {
    await must(admin.from("tasks").insert({ workspace_id: ws, event_id: mixer, title: t, due_on: due, status: st, priority: "medium", assignee_id: owner, created_by: owner }));
  }
  for (const [cat, name, p, c, pd] of [["Sound & lighting", "Sound and lighting hire", 97500, 97500, 0], ["Food & drink", "Catering tasting and deposit", 124800, 124800, 62400], ["Marketing", "Poster and print run", 36500, 36500, 36500]]) {
    await must(admin.from("budget_items").insert({ workspace_id: ws, event_id: mixer, category: cat, name, planned_minor: p, committed_minor: c, paid_minor: pd }));
  }
  // a collaborator and an organiser, for permission-restricted views
  for (const r of ["collaborator", "organiser"]) await must(admin.from("workspace_members").insert({ workspace_id: ws, user_id: uid(r), role: r }));
  // an empty workspace with one blank event (no tasks, guests, budget, schedule or layout)
  await open(page, "/onboarding");
  await page.getByLabel("Workspace name").fill("Empty Studio");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
  emptyWs = /\/w\/([0-9a-f-]{36})\//.exec(page.url())[1];
  emptyEv = (await mk(emptyWs, "A blank event", "planning", soon(30))).id;
}

const OWNER_SHOTS = [
  ["events", `/w/${ws}/events`], ["events-new", `/w/${ws}/events/new`], ["dashboard", `/w/${ws}/events/${mixer}`], ["dashboard-sample", `/w/${ws}/events/${ev}`],
  ["edit", `/w/${ws}/events/${mixer}/edit`], ["tasks", `/w/${ws}/events/${ev}/tasks`], ["suppliers", `/w/${ws}/events/${ev}/suppliers`], ["budget", `/w/${ws}/events/${ev}/budget`],
  ["guests", `/w/${ws}/events/${ev}/guests`], ["schedule", `/w/${ws}/events/${ev}/schedule`], ["layout", `/w/${ws}/events/${ev}/layout`], ["summary", `/w/${ws}/events/${ev}/summary`],
  ["settings", `/w/${ws}/settings`], ["plan", `/w/${ws}/upgrade`], ["checkout", `/w/${ws}/upgrade/sandbox?plan=organiser`],
  ["empty-events", `/w/${emptyWs}/events`], ["empty-dashboard", `/w/${emptyWs}/events/${emptyEv}`], ["empty-tasks", `/w/${emptyWs}/events/${emptyEv}/tasks`],
  ["empty-suppliers", `/w/${emptyWs}/events/${emptyEv}/suppliers`], ["empty-budget", `/w/${emptyWs}/events/${emptyEv}/budget`], ["empty-guests", `/w/${emptyWs}/events/${emptyEv}/guests`],
  ["empty-schedule", `/w/${emptyWs}/events/${emptyEv}/schedule`], ["empty-layout", `/w/${emptyWs}/events/${emptyEv}/layout`], ["empty-summary", `/w/${emptyWs}/events/${emptyEv}/summary`],
];
const PUBLIC_SHOTS = [
  ["landing", "/"], ["pricing", "/pricing"], ["privacy", "/privacy"], ["login", "/login"], ["signup", "/signup"], ["forgot", "/forgot-password"], ["reset", "/reset-password"],
  ["demo", "/demo"], ["demo-tasks", "/demo/tasks"], ["demo-budget", "/demo/budget"], ["demo-suppliers", "/demo/suppliers"], ["demo-guests", "/demo/guests"],
  ["demo-schedule", "/demo/schedule"], ["demo-layout", "/demo/layout"], ["demo-summary", "/demo/summary"], ["not-found", "/no-such-page"],
];
const anon = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
anon.setDefaultTimeout(20000);
const collab = await login("collaborator");
const COLLAB_SHOTS = [["collab-tasks", `/w/${ws}/events/${ev}/tasks`], ["collab-budget", `/w/${ws}/events/${ev}/budget`], ["collab-layout", `/w/${ws}/events/${ev}/layout`], ["collab-settings", `/w/${ws}/settings`], ["collab-plan", `/w/${ws}/upgrade`], ["collab-events-new", `/w/${ws}/events/new`]];

for (const w of widths) {
  const h = w >= 1024 ? 900 : 812;
  for (const p of [page, anon, collab]) await p.setViewportSize({ width: w, height: h });
  const shoot = async (p, name, path, post) => {
    if (!want(name)) return;
    try {
      await open(p, path);
      if (post) await post(p);
      await p.screenshot({ path: join(DIR, `${name}-${w}.png`), fullPage: true });
    } catch (e) {
      console.log(`${name}-${w}: ${String(e.message).split("\n")[0]}`);
    }
  };
  for (const [n, p] of OWNER_SHOTS) await shoot(page, n, p);
  for (const [n, p] of PUBLIC_SHOTS) await shoot(anon, n, p);
  for (const [n, p] of COLLAB_SHOTS) await shoot(collab, n, p);
  // states
  await shoot(page, "events-new-errors", `/w/${ws}/events/new`, async (p) => {
    await p.getByLabel("Event title").fill("   ");
    await p.getByLabel("Starts").fill("2027-03-01T15:00");
    await p.getByLabel("Ends").fill("2027-03-01T10:00");
    await p.getByRole("button", { name: "Create event" }).click();
    await p.getByText("Enter a title of 1 to 120 characters.").waitFor();
  });
  await shoot(anon, "login-error", "/login", async (p) => {
    await p.getByLabel("Email").fill("nobody@example.test");
    await p.getByLabel("Password").fill("wrong-password-1");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.getByText(/do not match an account/).waitFor();
  });
  await shoot(page, "dialog", `/w/${ws}/events`, async (p) => {
    await p.getByRole("button", { name: "Reset sample event" }).click();
    await p.waitForTimeout(300);
  });
  await shoot(page, "error-offline", `/w/${ws}/events/${mixer}/tasks`, async (p) => {
    const f = p.getByRole("form", { name: "Add a task" });
    await f.getByLabel("New task").fill("Offline task");
    await p.context().setOffline(true);
    await f.getByRole("button", { name: "Add task" }).click();
    await p.getByRole("heading", { name: "Something went wrong" }).waitFor();
    await p.context().setOffline(false);
  });
  if (w <= 768) {
    await shoot(page, "drawer", `/w/${ws}/events/${mixer}`, async (p) => {
      await p.getByRole("button", { name: "Open menu" }).click();
      await p.waitForTimeout(350);
    });
  }
}
console.log(`wrote screenshots to ${DIR}`);
await browser.close();
