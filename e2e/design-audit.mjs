// Redesign audit: the phone drawer, keyboard order and focus rings, reduced motion, the printed summary under the new frame,
// empty and permission-restricted states, and the venue planner at phone and desktop width. Uses the disposable accounts.
//   $env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e:design
// Needs: dev server on :3000, migrations 001 to 008. Output: PASS/FAIL per step; screenshots and the PDF go to E2E_SHOTS.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.DEV_USERS_PASSWORD;
const SHOTS = process.env.E2E_SHOTS ?? join(tmpdir(), "sceneset-design-audit");
mkdirSync(SHOTS, { recursive: true });
if (!PASSWORD) {
  console.error("Set DEV_USERS_PASSWORD to the password printed by `npm run dev:users -- create`.");
  process.exit(2);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = async (q) => {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
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
    if (process.env.E2E_VERBOSE) console.log(String(e.stack).split("\n").slice(0, 5).join("\n"));
  }
};
const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ baseURL: BASE, ...opts });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  return { ctx, page };
};
const open = async (page, p) => {
  await page.goto(p);
  await page.waitForLoadState("networkidle");
};
const signIn = async (page, role) => {
  await open(page, "/login");
  await page.getByLabel("Email").fill(`dev-${role}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !["/login", "/app"].includes(u.pathname));
  await page.waitForLoadState("networkidle");
};
const users = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users;
const uid = (r) => users.find((u) => u.email === `dev-${r}@example.test`).id;

// ---- fixtures: a workspace with the fictional sample event, a collaborator, and an empty workspace
const phone = await newPage({ viewport: { width: 375, height: 812 } });
const p = phone.page;
await signIn(p, "owner");
await p.getByLabel("Workspace name").fill("Audit Society");
await p.getByRole("button", { name: "Create workspace" }).click();
await p.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
const ws = /\/w\/([0-9a-f-]{36})\//.exec(p.url())[1];
await must(admin.from("workspaces").update({ plan: "organiser" }).eq("id", ws).select("id"));
await p.getByRole("button", { name: "Load a sample event" }).click();
await p.waitForURL(/\/events\/[0-9a-f-]{36}\?m=sample/);
const ev = /\/events\/([0-9a-f-]{36})/.exec(p.url())[1];
await must(admin.from("workspace_members").insert({ workspace_id: ws, user_id: uid("collaborator"), role: "collaborator" }));
await open(p, "/onboarding");
await p.getByLabel("Workspace name").fill("Audit Empty");
await p.getByRole("button", { name: "Create workspace" }).click();
await p.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
const emptyWs = /\/w\/([0-9a-f-]{36})\//.exec(p.url())[1];
const emptyEv = (await must(admin.from("events").insert({ workspace_id: emptyWs, title: "Nothing yet", starts_at: new Date(Date.now() + 9e8).toISOString(), ends_at: new Date(Date.now() + 9e8 + 36e5).toISOString(), timezone: "Asia/Hong_Kong", currency: "HKD", created_by: uid("owner") }).select("id").single())).id;
const base = `/w/${ws}/events/${ev}`;

await step("DRAWER: closed on a phone (links not focusable), opened by the menu button, closed by Escape with focus back on the button", async () => {
  await open(p, base);
  const menu = p.getByRole("button", { name: "Open menu" });
  assert((await menu.getAttribute("aria-expanded")) === "false", "menu should start collapsed");
  assert(!(await p.locator("#app-nav").isVisible()), "the drawer is visible while closed");
  // while closed, Tab must never land inside the drawer
  await p.keyboard.press("Tab"); // skip link
  for (let i = 0; i < 6; i++) {
    await p.keyboard.press("Tab");
    assert(!(await p.evaluate(() => !!document.activeElement?.closest("#app-nav"))), "focus entered the closed drawer");
  }
  await menu.click();
  assert((await p.locator("button[aria-controls=app-nav]").getAttribute("aria-expanded")) === "true", "aria-expanded not true when open");
  await p.locator("#app-nav").waitFor({ state: "visible" });
  await p.screenshot({ path: join(SHOTS, "drawer-open-375.png") });
  const box = await p.locator("#app-nav").boundingBox();
  assert(box && box.x >= -1 && box.width <= 375, `drawer geometry ${JSON.stringify(box)}`);
  await p.keyboard.press("Escape");
  await p.locator("#app-nav").waitFor({ state: "hidden" });
  assert(await p.evaluate(() => document.activeElement?.getAttribute("aria-controls") === "app-nav"), "focus did not return to the menu button");
});
await step("DRAWER: a link inside it navigates and closes it; the scrim closes it; the current page is marked", async () => {
  await open(p, base);
  await p.getByRole("button", { name: "Open menu" }).click();
  await p.locator("#app-nav").waitFor({ state: "visible" }); // the drawer slides in; its text is readable once it is visible
  const current = p.locator("#app-nav a[aria-current=page]");
  const marked = await p.evaluate(() => [...document.querySelectorAll("#app-nav a")].map((a) => `${a.textContent.trim()}=${a.getAttribute("aria-current")}`).join("; "));
  assert((await current.count()) === 1 && /Dashboard/.test(await current.innerText()), `current page not marked in the drawer: ${marked}; path ${new URL(p.url()).pathname.replace(/[0-9a-f-]{36}/g, "<id>")}`);
  await p.getByRole("link", { name: "Tasks and notes" }).click();
  await p.waitForURL(/\/tasks$/);
  await p.waitForLoadState("networkidle");
  assert(!(await p.locator("#app-nav").isVisible()), "the drawer stayed open after navigating");
  await p.getByRole("button", { name: "Open menu" }).click();
  await p.mouse.click(360, 400); // the scrim, outside the 248 px drawer
  await p.locator("#app-nav").waitFor({ state: "hidden" });
});
await step("KEYBOARD (desktop): the skip link is first and works; nav links come before the page; every stop shows a focus ring", async () => {
  const { page: d } = await newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(d, "owner");
  await open(d, base);
  await d.keyboard.press("Tab");
  assert(/Skip to main content/.test(await d.evaluate(() => document.activeElement.textContent)), "first stop is not the skip link");
  await d.keyboard.press("Enter");
  assert((await d.evaluate(() => location.hash)) === "#main", "skip link did not move to main");
  await open(d, base);
  const order = [];
  for (let i = 0; i < 24; i++) {
    await d.keyboard.press("Tab");
    const o = await d.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return { name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28), inNav: !!el.closest("#app-nav"), ring: (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none", tag: el.tagName };
    });
    order.push(o);
    assert(o.ring || o.tag === "BODY", `no focus indicator on "${o.name}"`);
  }
  const firstMain = order.findIndex((o, i) => i > 0 && !o.inNav); // index 0 is the skip link
  const lastNav = order.map((o) => o.inNav).lastIndexOf(true);
  assert(order.slice(0, 5).some((o) => o.inNav) && firstMain > 0 && lastNav < firstMain + 4, "sidebar links should come first, then the page");
  await d.screenshot({ path: join(SHOTS, "focus-desktop.png") });
  await d.context().close();
});
await step("REDUCED MOTION: transitions and animations are effectively off", async () => {
  const { page: r } = await newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await signIn(r, "owner");
  await open(r, base);
  const t = await r.evaluate(() => {
    const dur = (el) => parseFloat(getComputedStyle(el).transitionDuration.split(",")[0]);
    return { link: dur(document.querySelector("#app-nav a")), aside: dur(document.querySelector("#app-nav")), btn: dur(document.querySelector("main a[class*='rounded-md']")) };
  });
  assert(t.link <= 0.001 && t.aside <= 0.001 && t.btn <= 0.001, `durations ${JSON.stringify(t)}`);
  await r.context().close();
});
await step("PRINT: the summary prints as a plain document (no sidebar, top bar, buttons or menu); every section is present; nothing is clipped", async () => {
  const { page: a4, ctx } = await newPage({ viewport: { width: 794, height: 1123 } });
  await signIn(a4, "owner");
  await open(a4, `${base}/summary`);
  await a4.emulateMedia({ media: "print" });
  const rep = await a4.evaluate(() => {
    const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
    return {
      chrome: [...document.querySelectorAll("aside, header nav, button, form, input, select, textarea")].filter(vis).map((e) => e.tagName + ":" + (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 20)),
      marginLeft: getComputedStyle(document.querySelector(".shell-main")).marginLeft,
      wide: [...document.querySelectorAll("body *")].filter((e) => vis(e) && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length,
      bg: getComputedStyle(document.body).backgroundColor,
    };
  });
  assert(rep.chrome.length === 0, `visible in print: ${rep.chrome.join(", ")}`);
  assert(rep.marginLeft === "0px", `the content is still pushed right by the sidebar width (${rep.marginLeft})`);
  assert(rep.wide === 0, `${rep.wide} elements wider than the page`);
  assert(rep.bg === "rgb(255, 255, 255)", `background ${rep.bg}`);
  const pdf = join(SHOTS, "summary.pdf");
  writeFileSync(pdf, await a4.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
  const txt = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
  for (const n of ["Harbour Night Market", "Readiness", "Tasks and responsibilities", "Budget", "Suppliers and quotes", "Guests and headcount", "Running order", "Venue layout", "Prototype: use fictional information only"]) assert(txt.includes(n), `the printed plan lacks "${n}"`);
  assert(!/Sign out|Open menu|Print summary|Edit event|Switch workspace/.test(txt), "controls appear in the printed plan");
  await a4.screenshot({ path: join(SHOTS, "print-a4.png"), fullPage: true });
  await ctx.close();
});
await step("EMPTY STATES: a blank event shows an invitation, not a blank page, on every view", async () => {
  const { page: d, ctx } = await newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(d, "owner");
  const eb = `/w/${emptyWs}/events/${emptyEv}`;
  for (const [path, re] of [["", /No tasks yet/], ["/tasks", /No tasks yet/], ["/suppliers", /No suppliers yet/], ["/budget", /No budget lines/i], ["/guests", /No guests yet/], ["/schedule", /No (running order|entries)/i], ["/layout", /venue/i], ["/summary", /Readiness/]]) {
    await open(d, eb + path);
    const t = await d.locator("main").innerText();
    assert(re.test(t), `${path || "dashboard"}: no empty-state message (${t.slice(0, 80).replace(/\s+/g, " ")})`);
  }
  await open(d, `/w/${emptyWs}/events?show=archived`);
  await ctx.close();
});
await step("PERMISSIONS: a collaborator sees read-only views with an explanation, and owner-only pages say so", async () => {
  const { page: c, ctx } = await newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(c, "collaborator");
  await open(c, `${base}/budget`);
  assert((await c.locator("section[aria-labelledby=add-h]").count()) === 0, "collaborator sees the add-budget form");
  await open(c, `${base}/layout`);
  assert((await c.getByRole("button", { name: "Save layout" }).count()) === 0, "collaborator sees Save layout");
  assert(/You can read the layout/.test(await c.locator("main").innerText()), "no explanation of the restriction on the layout page");
  await open(c, `/w/${ws}/events/new`);
  await c.getByText("Only organisers and owners can create events").waitFor();
  await open(c, `/w/${ws}/upgrade`);
  await c.locator("[data-owner-only]").waitFor();
  await open(c, `/w/${ws}/settings`);
  await c.getByText("Only owners can add members or change roles.").waitFor();
  await c.screenshot({ path: join(SHOTS, "collab-settings.png"), fullPage: true });
  await ctx.close();
});
await step("PLANNER: at phone and desktop width the plan, the controls and the object list are reachable; objects can be focused and moved with the keyboard", async () => {
  const { page: d, ctx } = await newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(d, "owner");
  for (const [w, h] of [[1440, 900], [375, 812]]) {
    await d.setViewportSize({ width: w, height: h });
    await open(d, `${base}/layout`);
    assert((await d.locator("svg [role=button]").count()) === 11, `${w}px: expected 11 objects`);
    assert((await d.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, `${w}px: page scrolls sideways`);
    const svg = await d.locator("svg:has([role=button])").first().boundingBox();
    assert(svg && svg.width >= Math.min(300, w - 40), `${w}px: the plan is too small (${svg?.width})`);
    await d.screenshot({ path: join(SHOTS, `planner-${w}.png`), fullPage: true });
  }
  await d.setViewportSize({ width: 1440, height: 900 });
  const obj = d.locator("svg [role=button]").first();
  await obj.focus();
  const before = await obj.getAttribute("aria-label");
  await d.keyboard.press("ArrowRight");
  await d.keyboard.press("ArrowDown");
  const after = await obj.getAttribute("aria-label");
  assert(before !== after, "arrow keys did not move the object");
  assert(/unsaved/i.test(await d.locator("main").innerText()), "the move is not shown as unsaved");
  await ctx.close();
});
await browser.close();
const failed = results.filter(([, s]) => !s).length;
console.log(`\n${results.filter(([, s]) => s).length}/${results.length} passed. Screenshots and PDF: ${SHOTS}`);
process.exit(failed ? 1 : 0);
