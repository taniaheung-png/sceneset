// Browser checks for phase 2 (return-to-page, sign-in/out, onboarding, member management, role views).
// Each role runs in its OWN browser context (separate cookies), so sessions never mix.
// Needs: dev server on :3000, and the disposable accounts from `npm run dev:users -- create`.
//   $env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e
// Email-dependent checks (sign-up confirmation, password reset) are NOT here; they need a real inbox.
import { chromium } from "playwright";

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
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const newPage = async () => {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  return { ctx, page };
};
const open = async (page, path) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle"); // wait for hydration so server-action forms submit properly
};
const signIn = async (page, role, next) => {
  await open(page, next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email(role));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // /app is a pure redirect page (to your workspace or /onboarding), so wait until it has resolved.
  await page.waitForURL((u) => !["/login", "/app"].includes(u.pathname));
  await page.waitForLoadState("networkidle");
};
const sessionCookies = async (ctx) => (await ctx.cookies()).filter((c) => c.name.startsWith("sb-")).length;

const A = { owner: await newPage(), organiser: await newPage(), collab: await newPage(), outsider: await newPage() };
let wsId;

try {
  // ---------------------------------------------------------------- P2.17 return to intended page
  await step("signed-out visit to /onboarding redirects to /login?next=/onboarding", async () => {
    const { page } = A.outsider;
    await open(page, "/onboarding");
    const u = new URL(page.url());
    assert(u.pathname === "/login" && u.searchParams.get("next") === "/onboarding", `got ${u.pathname}${u.search}`);
  });
  await step("after sign-in the user returns to the page they asked for (/onboarding)", async () => {
    const { page } = A.outsider;
    await page.getByLabel("Email").fill(email("outsider"));
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => u.pathname === "/onboarding");
  });
  await step("an off-site ?next= is ignored (no open redirect)", async () => {
    const { page, ctx } = await newPage();
    await signIn(page, "owner", "//evil.example/steal");
    const u = new URL(page.url());
    assert(u.origin === BASE, `left the site: ${u.origin}`);
    assert(u.pathname === "/onboarding", `expected /app -> /onboarding, got ${u.pathname}`);
    await ctx.close();
  });

  // ---------------------------------------------------------------- P2.14 session and sign-out
  await step("signed-in session survives reload and a second tab", async () => {
    const { page, ctx } = A.outsider;
    await page.reload();
    await page.waitForLoadState("networkidle");
    assert(new URL(page.url()).pathname === "/onboarding", `reload went to ${page.url()}`);
    const tab2 = await ctx.newPage();
    await tab2.goto("/app");
    await tab2.waitForURL((u) => u.pathname === "/onboarding");
    await tab2.close();
    assert((await sessionCookies(ctx)) > 0, "no session cookie");
  });

  // ---------------------------------------------------------------- P2.18 onboarding
  await step("onboarding rejects a blank workspace name and keeps you on the page", async () => {
    const { page } = A.owner;
    await signIn(page, "owner");
    assert(new URL(page.url()).pathname === "/onboarding", `new user should land on /onboarding, got ${page.url()}`);
    await page.getByLabel("Workspace name").fill("   ");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.waitForURL(/error=name/);
    await page.getByText("Enter a workspace name").waitFor();
  });
  await step("creating a workspace opens it, and it persists after reload and re-login", async () => {
    const { page, ctx } = A.owner;
    await page.getByLabel("Workspace name").fill("E2E Market Co");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    wsId = /\/w\/([0-9a-f-]{36})\//.exec(page.url())[1];
    await page.getByRole("heading", { name: "Events", exact: true }).waitFor();
    await page.reload();
    await page.getByText("E2E Market Co").first().waitFor();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    assert((await sessionCookies(ctx)) === 0, "session cookie still present after sign-out");
    await signIn(page, "owner");
    assert(page.url().endsWith(`/w/${wsId}/events`), `re-login should land on the workspace events list, got ${page.url()}`);
  });
  await step("after sign-out, private pages redirect to login", async () => {
    const { page } = await newPage(); // fresh context = signed out
    await open(page, `/w/${wsId}/settings`);
    assert(new URL(page.url()).pathname === "/login", page.url());
  });

  // ---------------------------------------------------------------- P2.19 member management (owner)
  const settings = `/w/${wsId}/settings`;
  const ownerPage = A.owner.page;
  const addMember = async (mail, role) => {
    const form = ownerPage.locator("form:has(input[name=email])");
    await form.getByLabel("Add a member by email").fill(mail);
    await form.getByLabel("Role").selectOption(role);
    await form.getByRole("button", { name: "Add member" }).click();
    await ownerPage.waitForURL(/[?&]m=/);
  };
  await step("owner adds an organiser and a collaborator", async () => {
    await open(ownerPage, settings);
    await addMember(email("organiser"), "organiser");
    await ownerPage.getByText("Member added.").waitFor();
    await addMember(email("collaborator"), "collaborator");
    await ownerPage.getByText("Member added.").waitFor();
    for (const n of ["Dev organiser", "Dev collaborator"]) await ownerPage.getByRole("row", { name: new RegExp(n) }).waitFor();
  });
  await step("adding an unknown email and a duplicate both show clear errors", async () => {
    await addMember("nobody-registered@example.test", "collaborator");
    await ownerPage.getByText("No registered account has that email").waitFor();
    await addMember(email("organiser"), "organiser");
    await ownerPage.getByText("That person is already a member").waitFor();
  });
  await step("the only owner cannot be demoted", async () => {
    const row = ownerPage.getByRole("row", { name: /Dev owner/ });
    await row.getByLabel("Role").selectOption("organiser");
    await row.getByRole("button", { name: "Update" }).click();
    await ownerPage.getByText("A workspace must keep at least one owner").waitFor();
  });
  await step("owner changes a role and back", async () => {
    const row = () => ownerPage.getByRole("row", { name: /Dev collaborator/ });
    await row().getByLabel("Role").selectOption("organiser");
    await row().getByRole("button", { name: "Update" }).click();
    await ownerPage.getByText("Role updated.").waitFor();
    assert((await row().getByLabel("Role").inputValue()) === "organiser", "role not saved");
    await row().getByLabel("Role").selectOption("collaborator");
    await row().getByRole("button", { name: "Update" }).click();
    await ownerPage.waitForURL(/[?&]m=role-changed/);
    assert((await row().getByLabel("Role").inputValue()) === "collaborator", "role not restored");
  });

  // ---------------------------------------------------------------- role restrictions (separate sessions)
  for (const [key, role] of [["organiser", "organiser"], ["collab", "collaborator"]]) {
    await step(`${role} sees Settings read-only (no add form, no role editing, no emails)`, async () => {
      const { page } = A[key];
      await signIn(page, role === "collaborator" ? "collaborator" : role, settings);
      assert(page.url().endsWith(settings), `landed on ${page.url()}`);
      await page.getByText("Only owners can add members or change roles.").waitFor();
      assert((await page.getByLabel("Add a member by email").count()) === 0, "add-member form visible");
      assert((await page.getByRole("button", { name: "Update" }).count()) === 0, "role update buttons visible");
      assert((await page.getByRole("columnheader", { name: "Email" }).count()) === 0, "email column visible");
      const body = await page.locator("main").innerText();
      assert(!/@example\.test/.test(body.replace(/Signed in as [^\n]*/, "")), "a member email address is visible");
      await page.getByRole("button", { name: "Leave" }).waitFor();
      assert((await page.getByRole("button", { name: "Remove" }).count()) === 0, "Remove button visible");
    });
  }
  await step("a non-member gets 'Page not found' for the workspace and its settings", async () => {
    const { page } = A.outsider;
    for (const p of [`/w/${wsId}`, settings]) {
      await open(page, p);
      await page.getByText("Page not found").waitFor();
    }
  });
  await step("a malformed workspace id is also 'Page not found'", async () => {
    await open(A.outsider.page, "/w/not-a-uuid");
    await A.outsider.page.getByText("Page not found").waitFor();
  });

  // ---------------------------------------------------------------- remove and leave
  await step("owner removes the organiser through the confirmation dialog; their access ends", async () => {
    const row = ownerPage.getByRole("row", { name: /Dev organiser/ });
    await row.getByRole("button", { name: "Remove" }).click();
    await ownerPage.getByRole("dialog").getByRole("button", { name: "Remove member" }).click();
    await ownerPage.getByText("Member removed.").waitFor();
    assert((await ownerPage.getByRole("row", { name: /Dev organiser/ }).count()) === 0, "row still present");
    const { page } = A.organiser;
    await open(page, `/w/${wsId}`);
    await page.getByText("Page not found").waitFor();
  });
  await step("a collaborator can leave; they are sent on and lose access", async () => {
    const { page } = A.collab;
    await open(page, settings);
    await page.getByRole("button", { name: "Leave" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Leave workspace" }).click();
    await page.waitForURL((u) => u.pathname === "/onboarding"); // /app -> no workspace left
    await open(page, settings);
    await page.getByText("Page not found").waitFor();
  });
} finally {
  await browser.close();
}
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
