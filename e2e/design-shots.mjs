// Visual-review screenshots of the real app with believable fictional data (not a mock-up: every page is the working page).
// Usage (dev server on :3000, fresh accounts from `npm run dev:users -- create`):
//   $env:DEV_USERS_PASSWORD = "<printed password>"; node --env-file=.env.local e2e/design-shots.mjs <tag>
// <tag> is a folder name under docs/design (for example "before" or "after"). Fixtures are created through the service key
// into a throw-away workspace owned by the disposable account and removed by `npm run dev:users -- delete`.
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

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);
const open = async (p) => {
  await page.goto(p);
  await page.waitForLoadState("networkidle");
};

// ---- fixtures
await open("/login");
await page.getByLabel("Email").fill("dev-owner@example.test");
await page.getByLabel("Password").fill(PASSWORD);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((u) => !["/login", "/app"].includes(u.pathname));
const existing = (await admin.from("workspaces").select("id").eq("name", "Studio Society").limit(1)).data?.[0];
let ws, ev, mixer;
if (existing) {
  // reuse the fixtures from an earlier run (so before and after shots show the same data)
  ws = existing.id;
  ev = (await must(admin.from("events").select("id").eq("workspace_id", ws).eq("demo", true).limit(1)))[0].id;
  mixer = (await must(admin.from("events").select("id").eq("workspace_id", ws).eq("title", "Autumn Society Mixer").limit(1)))[0].id;
} else {
  await page.getByLabel("Workspace name").fill("Studio Society");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
  ws = /\/w\/([0-9a-f-]{36})\//.exec(page.url())[1];
  await must(admin.from("workspaces").update({ plan: "organiser" }).eq("id", ws).select("id"));
  const owner = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === "dev-owner@example.test").id;
  await page.getByRole("button", { name: "Load a sample event" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}\?m=sample/);
  ev = /\/events\/([0-9a-f-]{36})/.exec(page.url())[1];
  const venue = (await must(admin.from("venues").insert({ workspace_id: ws, name: "The Glasshouse", width_cm: 1800, depth_cm: 1200 }).select("id").single())).id;
  const mk = async (title, status, start, extra = {}) => must(admin.from("events").insert({ workspace_id: ws, title, status, starts_at: start, ends_at: new Date(Date.parse(start) + 4 * 3600e3).toISOString(), timezone: "Asia/Hong_Kong", currency: "HKD", venue_id: venue, capacity: 120, budget_target_minor: 4_000_000, goals: "A warm evening with local food and good music.", created_by: owner, ...extra }).select("id").single());
  const soon = (d) => new Date(Date.now() + d * 86400e3).toISOString();
  mixer = (await mk("Autumn Society Mixer", "planning", soon(4))).id;
  await mk("Community Makers Market", "confirmed", soon(12));
  await mk("Winter Welcome Showcase", "planning", soon(26));
  const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
  for (const [t, due, st] of [["Collect final audio quote", day(1), "in_progress"], ["Confirm the food-truck menu", day(2), "in_progress"], ["Share the mixer poster", day(3), "todo"], ["Confirm venue access window", day(7), "todo"], ["Draft the volunteer welcome note", day(-2), "done"]]) {
    await must(admin.from("tasks").insert({ workspace_id: ws, event_id: mixer, title: t, due_on: due, status: st, priority: "medium", assignee_id: owner, created_by: owner }));
  }
  for (const [cat, name, p, c, pd] of [["Sound & lighting", "Sound and lighting hire", 97500, 97500, 0], ["Food & drink", "Catering tasting and deposit", 124800, 124800, 62400], ["Marketing", "Poster and print run", 36500, 36500, 36500]]) {
    await must(admin.from("budget_items").insert({ workspace_id: ws, event_id: mixer, category: cat, name, planned_minor: p, committed_minor: c, paid_minor: pd }));
  }

}

// ---- shots
const SHOTS = [
  ["landing", "/", false], ["pricing", "/pricing", false], ["login", "/login", false], ["demo", "/demo", false],
  ["events", `/w/${ws}/events`, true], ["dashboard", `/w/${ws}/events/${mixer}`, true], ["dashboard-sample", `/w/${ws}/events/${ev}`, true],
  ["tasks", `/w/${ws}/events/${ev}/tasks`, true], ["suppliers", `/w/${ws}/events/${ev}/suppliers`, true], ["budget", `/w/${ws}/events/${ev}/budget`, true],
  ["guests", `/w/${ws}/events/${ev}/guests`, true], ["schedule", `/w/${ws}/events/${ev}/schedule`, true], ["layout", `/w/${ws}/events/${ev}/layout`, true],
  ["summary", `/w/${ws}/events/${ev}/summary`, true], ["settings", `/w/${ws}/settings`, true], ["plan", `/w/${ws}/upgrade`, true],
];
const only = process.env.SHOTS_ONLY ? process.env.SHOTS_ONLY.split(",") : null;
for (const [w, h, tag] of [[1440, 900, "1440"], [375, 812, "375"], [1024, 768, "1024"], [768, 1024, "768"]]) {
  if (process.env.SHOT_WIDTHS && !process.env.SHOT_WIDTHS.split(",").includes(tag)) continue;
  await page.setViewportSize({ width: w, height: h });
  for (const [name, path] of SHOTS.map(([n, p]) => [n, p])) {
    if (only && !only.includes(name)) continue;
    await open(path);
    await page.screenshot({ path: join(DIR, `${name}-${tag}.png`), fullPage: tag === "375" || name !== "dashboard" ? true : true });
  }
}
console.log(`wrote screenshots to ${DIR}; workspace ${ws}`);
await browser.close();
