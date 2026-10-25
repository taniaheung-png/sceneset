// Browser checks for phase 3: events (create, edit, stale edit, archive, delete, search), the event dashboard,
// the task board with filters, notes, collaborator limits, and event/workspace isolation.
// One isolated browser context per role. Needs the dev server on :3000 and the disposable accounts:
//   $env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e:p3
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
    if (process.env.E2E_VERBOSE) console.log(String(e.stack).split("\n").slice(0, 8).join("\n"));
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
/** Click a submit control and wait for the server-action POST and the resulting render (avoids racing a stale banner). */
const submit = async (page, locator) => {
  try {
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), locator.click()]);
  } catch (e) {
    if (process.env.E2E_VERBOSE) console.log("     [debug] url", page.url(), "disabled", await locator.isDisabled().catch(() => "?"), "| inputs:", await page.locator("form[aria-label=\"Add a task\"]").evaluate((f) => [...f.elements].map((x) => `${x.name}=${x.value}`).join(", ")).catch(() => "?"));
    throw e;
  }
  await page.waitForLoadState("networkidle");
};
const notFound = async (page, path) => {
  await open(page, path);
  await page.getByText("Page not found").waitFor();
};
/** Reads the To do / In progress / Done / Overdue numbers from the dashboard's task card. */
const taskCounts = async (page) => {
  const t = await page.locator("section[aria-labelledby=d-tasks]").innerText();
  const n = (label) => Number(new RegExp(`(\\d+)\\s+${label}`).exec(t)?.[1] ?? NaN);
  return { todo: n("To do"), doing: n("In progress"), done: n("Done"), overdue: n("Overdue") };
};

const A = { owner: await newPage(), organiser: await newPage(), collab: await newPage(), outsider: await newPage() };
const owner = A.owner.page;
let ws, ev, ev2, base;

try {
  // -------------------------------------------------------------------- setup
  await step("owner creates a workspace; the events list shows an empty state with a create button", async () => {
    await signIn(owner, "owner");
    await owner.getByLabel("Workspace name").fill("P3 Market Co");
    await owner.getByRole("button", { name: "Create workspace" }).click();
    await owner.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    ws = /\/w\/([0-9a-f-]{36})\//.exec(owner.url())[1];
    await owner.getByText("No events yet").waitFor();
    await owner.getByRole("link", { name: "Create your first event" }).waitFor();
  });
  await step("owner adds an organiser and a collaborator", async () => {
    await open(owner, `/w/${ws}/settings`);
    for (const [mail, role] of [[email("organiser"), "organiser"], [email("collaborator"), "collaborator"]]) {
      const form = owner.locator("form:has(input[name=email])");
      await form.getByLabel("Add a member by email").fill(mail);
      await form.getByLabel("Role").selectOption(role);
      await form.getByRole("button", { name: "Add member" }).click();
      await owner.getByText("Member added.").waitFor();
    }
  });

  await step("a collection notice with a privacy link shows on the member, event and note forms (P3.13)", async () => {
    for (const path of [`/w/${ws}/settings`, `/w/${ws}/events/new`]) {
      await open(owner, path);
      await owner.getByText("is stored in your workspace to run your plan", { exact: false }).first().waitFor();
      assert((await owner.getByRole("link", { name: "privacy notice" }).count()) > 0, `no privacy link on ${path}`);
    }
  });

  // -------------------------------------------------------------------- events (P3.1 - P3.6)
  await step("event form: invalid input shows field errors and keeps everything typed", async () => {
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("   ");
    await owner.getByLabel("Goals").fill("Sell out the night market");
    await owner.getByLabel("Starts").fill("2026-11-14T15:00");
    await owner.getByLabel("Ends").fill("2026-11-14T10:00"); // before the start
    await owner.getByLabel("Budget target").fill("-5");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.getByText("Enter a title of 1 to 120 characters.").waitFor();
    await owner.getByText("The end must be after the start.").waitFor();
    await owner.getByText(/Enter an amount like/).waitFor();
    assert((await owner.getByLabel("Goals").inputValue()) === "Sell out the night market", "goals lost");
    assert((await owner.getByLabel("Budget target").inputValue()) === "-5", "budget lost");
    assert((await owner.getByLabel("Starts").inputValue()) === "2026-11-14T15:00", "start lost");
  });
  await step("creating an event with an overnight end, a new venue, capacity and budget works", async () => {
    await owner.getByLabel("Event title").fill("Harbour Night Market");
    await owner.getByLabel("Ends").fill("2026-11-15T01:00");
    await owner.getByLabel("Capacity").fill("150");
    await owner.getByLabel("Budget target").fill("80,000");
    await owner.getByText("Or add a new venue").click();
    await owner.getByLabel("Venue name").fill("Pier 9 Courtyard");
    await owner.getByLabel("Width (m)").fill("20");
    await owner.getByLabel("Depth (m)").fill("15");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\/events\/[0-9a-f-]{36}\?m=created$/);
    ev = /\/events\/([0-9a-f-]{36})/.exec(owner.url())[1];
    base = `/w/${ws}/events/${ev}`;
    await owner.getByText("Event created.").waitFor();
    const t = (await owner.locator("main").innerText()).replace(/\s/g, " ");
    for (const s of ["Harbour Night Market", "Pier 9 Courtyard", "HKD 80,000", "150"]) assert(t.includes(s), `dashboard misses ${s}`);
    assert(/Sat 14 Nov, 15:00 to Sun 15 Nov, 01:00/.test(t), "overnight range not shown in the event timezone");
  });
  await step("the new event appears in the list; search and status filters work; clear and no-results states", async () => {
    await open(owner, `/w/${ws}/events`);
    await owner.getByRole("link", { name: "Harbour Night Market" }).waitFor();
    await open(owner, `/w/${ws}/events?q=harbour`);
    await owner.getByRole("link", { name: "Harbour Night Market" }).waitFor();
    await open(owner, `/w/${ws}/events?q=zzz-nothing`);
    await owner.getByText("No events match").waitFor();
    await owner.getByRole("link", { name: "Clear filters" }).first().click();
    await owner.getByRole("link", { name: "Harbour Night Market" }).waitFor();
    await open(owner, `/w/${ws}/events?status=done`);
    await owner.getByText("No events match").waitFor();
  });
  await step("editing an event persists the change", async () => {
    await open(owner, `${base}/edit`);
    await owner.getByLabel("Event title").fill("Harbour Night Market 2026");
    await owner.getByLabel("Planning status").selectOption("confirmed");
    await owner.getByRole("button", { name: "Save changes" }).click();
    await owner.waitForURL(/\?m=saved$/);
    await owner.getByRole("heading", { name: "Harbour Night Market 2026" }).waitFor();
    await owner.getByText("Confirmed").first().waitFor();
  });
  await step("stale edit: a second tab saving old data is refused instead of overwriting", async () => {
    const a = await owner.context().newPage();
    const b = await owner.context().newPage();
    for (const p of [a, b]) await open(p, `${base}/edit`);
    await a.getByLabel("Goals").fill("Edited in tab A");
    await a.getByRole("button", { name: "Save changes" }).click();
    await a.waitForURL(/\?m=saved$/);
    await b.getByLabel("Goals").fill("Edited in tab B (stale)");
    await b.getByRole("button", { name: "Save changes" }).click();
    await b.getByText("changed by someone else").waitFor();
    assert((await b.getByLabel("Goals").inputValue()) === "Edited in tab B (stale)", "typed text was lost");
    await open(b, base);
    assert((await b.locator("main").innerText()).includes("Edited in tab A"), "tab A's save was overwritten");
    await a.close();
    await b.close();
  });
  await step("a second event enables the switcher, which keeps the current section", async () => {
    await open(owner, `/w/${ws}/events/new`);
    await owner.getByLabel("Event title").fill("Lantern Showcase");
    await owner.getByLabel("Starts").fill("2026-12-05T18:00");
    await owner.getByLabel("Ends").fill("2026-12-05T22:00");
    await owner.getByRole("button", { name: "Create event" }).click();
    await owner.waitForURL(/\?m=created$/);
    ev2 = /\/events\/([0-9a-f-]{36})/.exec(owner.url())[1];
    await open(owner, `${base}/tasks`);
    await owner.getByLabel("Switch event").selectOption(ev2);
    await owner.waitForURL(`**/events/${ev2}/tasks`);
  });

  // -------------------------------------------------------------------- tasks (P3.8 - P3.10)
  await step("empty task board and dashboard show their empty states", async () => {
    await open(owner, `${base}/tasks`);
    await owner.getByText("No tasks yet").waitFor();
    await owner.getByText("is stored in your workspace to run your plan").first().waitFor(); // note form notice (P3.13)
    await open(owner, base);
    await owner.getByText("No tasks yet. Add the first one").waitFor();
  });
  const addTask = async (title, { assignee = "", due = "", priority = "medium" } = {}) => {
    const form = owner.getByRole("form", { name: "Add a task" });
    // React resets the form after the previous action finishes rendering; filling before that would be wiped.
    await owner.waitForFunction(() => document.querySelector("form[aria-label='Add a task'] input[name=title]").value === "");
    await form.getByLabel("New task").fill(title);
    if (assignee) await form.getByLabel("Assign to").selectOption({ label: assignee });
    if (due) await form.getByLabel("Due").fill(due);
    await form.getByLabel("Priority").selectOption(priority);
    await submit(owner, form.getByRole("button", { name: "Add task" }));
    await owner.getByText("Task added.").waitFor();
  };
  await step("owner adds tasks (assigned, overdue, unassigned) and the dashboard counts match", async () => {
    await open(owner, `${base}/tasks`);
    await addTask("Confirm stage supplier", { assignee: "Dev collaborator", due: "2020-01-01", priority: "high" });
    await addTask("Print signs", { due: "2099-01-01" });
    await addTask("Book sound engineer", { assignee: "Dev organiser" });
    await open(owner, base);
    const c = await taskCounts(owner);
    assert(c.todo === 3 && c.doing === 0 && c.done === 0 && c.overdue === 1, JSON.stringify(c));
    await owner.getByText("1 task is overdue.").waitFor();
  });
  await step("the overdue warning links to the filtered board", async () => {
    await owner.getByRole("link", { name: "Review overdue tasks" }).click();
    await owner.waitForURL(/tasks\?due=overdue/);
    await owner.locator('[data-task="Confirm stage supplier"]').waitFor();
    assert((await owner.locator('[data-task="Print signs"]').count()) === 0, "non-overdue task shown");
    await owner.getByText("Showing 1 of 3 tasks.").waitFor();
  });
  await step("owner moves a task and the dashboard counts follow", async () => {
    await open(owner, `${base}/tasks`);
    await owner.locator('[data-task="Print signs"]').getByRole("button", { name: "Move to In progress" }).click();
    await owner.getByText("Task moved.").waitFor();
    await open(owner, base);
    const c = await taskCounts(owner);
    assert(c.todo === 2 && c.doing === 1, JSON.stringify(c));
  });
  await step("filters: by status, assignee, none-match state and clear", async () => {
    await open(owner, `${base}/tasks?status=in_progress`);
    await owner.locator('[data-task="Print signs"]').waitFor();
    assert((await owner.locator('[data-task="Confirm stage supplier"]').count()) === 0, "status filter leaked");
    await open(owner, `${base}/tasks?assignee=none`);
    await owner.locator('[data-task="Print signs"]').waitFor();
    await open(owner, `${base}/tasks?status=done`);
    await owner.getByText("No tasks match").waitFor();
    await owner.getByRole("link", { name: "Clear filters" }).first().click();
    await owner.locator('[data-task="Book sound engineer"]').waitFor();
    await open(owner, base);
    const c = await taskCounts(owner);
    assert(c.todo === 2 && c.doing === 1, `filters changed the totals: ${JSON.stringify(c)}`);
  });
  await step("editing a task keeps the change after reload", async () => {
    await open(owner, `${base}/tasks`);
    const card = owner.locator('[data-task="Book sound engineer"]');
    await card.getByText("Edit task", { exact: true }).click();
    await card.getByLabel("Title").fill("Book sound engineer (PA)");
    await card.getByRole("button", { name: "Save task" }).click();
    await owner.getByText("Task saved.").waitFor();
    await owner.reload();
    await owner.locator('[data-task="Book sound engineer (PA)"]').waitFor();
  });

  await step("a task can be moved with the keyboard alone, then deleted after confirmation", async () => {
    await open(owner, `${base}/tasks`);
    await addTask("Temporary task");
    const card = owner.locator('[data-task="Temporary task"]');
    await card.getByRole("button", { name: "Move to In progress" }).focus();
    await Promise.all([owner.waitForResponse((r) => r.request().method() === "POST"), owner.keyboard.press("Enter")]);
    await owner.waitForLoadState("networkidle");
    await owner.getByText("Task moved.").waitFor();
    const inProgress = owner.locator('section[aria-labelledby="col-in_progress"]');
    await inProgress.locator('[data-task="Temporary task"]').waitFor();
    await owner.locator('[data-task="Temporary task"]').getByRole("button", { name: "Delete" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete task" }).click();
    await owner.getByText("Task deleted.").waitFor();
    assert((await owner.locator('[data-task="Temporary task"]').count()) === 0, "task still shown after delete");
  });

  // -------------------------------------------------------------------- collaborator limits (P3.11)
  await step("collaborator sees the board but cannot create, edit or delete; can move only their own task", async () => {
    const p = A.collab.page;
    await signIn(p, "collaborator", `${base}/tasks`);
    await p.locator('[data-task="Confirm stage supplier"]').waitFor();
    assert((await p.getByRole("form", { name: "Add a task" }).count()) === 0, "create form visible");
    assert((await p.getByText("Edit task", { exact: true }).count()) === 0, "edit visible");
    assert((await p.getByRole("button", { name: "Delete" }).count()) === 0, "delete visible");
    const own = p.locator('[data-task="Confirm stage supplier"]');
    const other = p.locator('[data-task="Print signs"]');
    assert((await own.getByRole("button", { name: /Move to/ }).count()) === 2, "own task cannot be moved");
    assert((await other.getByRole("button", { name: /Move to/ }).count()) === 0, "someone else's task can be moved");
    await own.getByRole("button", { name: "Move to Done" }).click();
    await p.getByText("Task moved.").waitFor();
  });
  await step("collaborator cannot create or edit events", async () => {
    const p = A.collab.page;
    await open(p, `/w/${ws}/events/new`);
    await p.getByText("Only organisers and owners can create events").waitFor();
    await open(p, `${base}/edit`);
    await p.getByText("Only organisers and owners can edit events").waitFor();
    await open(p, `/w/${ws}/events`);
    assert((await p.getByRole("link", { name: "New event" }).count()) === 0, "New event button visible");
  });

  // -------------------------------------------------------------------- notes (P3.12)
  await step("notes: add, see across roles, edit own, role-based edit rights", async () => {
    const c = A.collab.page;
    await open(c, `${base}/tasks`);
    await c.getByLabel("New note").fill("Collaborator note: stage arrives at 3pm");
    await c.getByRole("button", { name: "Add note" }).click();
    await c.getByText("Note added.").waitFor();
    const o = A.organiser.page;
    await signIn(o, "organiser", `${base}/tasks`);
    await o.locator("[data-note] p", { hasText: "Collaborator note: stage arrives at 3pm" }).waitFor();
    await o.getByLabel("New note").fill("Organiser note: sound check booked");
    await o.getByRole("button", { name: "Add note" }).click();
    await o.getByText("Note added.").waitFor();
    // the organiser may edit anyone's note; the collaborator only their own
    await open(c, `${base}/tasks`);
    const notes = c.locator("[data-note]");
    assert((await notes.filter({ hasText: "Organiser note" }).getByText("Edit note").count()) === 0, "collaborator can edit organiser's note");
    const mine = notes.filter({ hasText: "Collaborator note" });
    await mine.getByText("Edit note").click();
    await mine.getByLabel("Note", { exact: true }).fill("Collaborator note: stage arrives at 4pm");
    await mine.getByRole("button", { name: "Save note" }).click();
    await c.getByText("Note saved.").waitFor();
    await c.locator("[data-note] p", { hasText: "stage arrives at 4pm" }).waitFor();
  });
  await step("deleting a note needs confirmation", async () => {
    const o = A.organiser.page;
    await open(o, `${base}/tasks`);
    const note = o.locator("[data-note]").filter({ hasText: "Organiser note" });
    await note.getByRole("button", { name: "Delete" }).click();
    await o.getByRole("dialog").getByRole("button", { name: "Delete note" }).click();
    await o.getByText("Note deleted.").waitFor();
    assert((await o.locator("[data-note] p", { hasText: "Organiser note: sound check booked" }).count()) === 0, "note still shown");
  });

  // -------------------------------------------------------------------- persistence (refresh / re-login)
  await step("after sign-out and sign-in the data and counts are unchanged", async () => {
    await owner.getByRole("button", { name: "Sign out" }).click();
    await owner.waitForURL((u) => u.pathname === "/");
    await signIn(owner, "owner", base);
    const c = await taskCounts(owner);
    assert(c.done === 1 && c.doing === 1 && c.todo === 1, JSON.stringify(c));
    assert((await owner.locator("main").innerText()).includes("Edited in tab A"), "goals lost");
  });

  // -------------------------------------------------------------------- isolation (P3.6)
  await step("another workspace's user cannot open this workspace, its events, tasks or edit page", async () => {
    const p = A.outsider.page;
    await signIn(p, "outsider");
    await p.getByLabel("Workspace name").fill("Outsider Co");
    await p.getByRole("button", { name: "Create workspace" }).click();
    await p.waitForURL(/\/w\/[0-9a-f-]{36}\/events$/);
    for (const path of [`/w/${ws}/events`, base, `${base}/tasks`, `${base}/edit`]) await notFound(p, path);
  });
  await step("an event id from another workspace is not found even inside your own workspace URL", async () => {
    const p = A.outsider.page;
    const own = /\/w\/([0-9a-f-]{36})\//.exec(p.url())?.[1] ?? /\/w\/([0-9a-f-]{36})/.exec(await p.evaluate(() => location.href))[1];
    for (const path of [`/w/${own}/events/${ev}`, `/w/${own}/events/${ev}/tasks`]) await notFound(p, path);
    await notFound(p, `/w/${own}/events/not-a-uuid`);
  });

  // -------------------------------------------------------------------- archive and delete (P3.4)
  await step("archive hides the event; the archived view lists it; restore brings it back", async () => {
    await open(owner, `${base}/edit`);
    await owner.getByRole("button", { name: "Archive event" }).first().click();
    await owner.getByRole("dialog").getByRole("button", { name: "Archive event" }).click();
    await owner.waitForURL(/events\?m=archived/);
    assert((await owner.getByRole("link", { name: "Harbour Night Market 2026" }).count()) === 0, "archived event still in active list");
    await open(owner, `/w/${ws}/events?archived=1`);
    await owner.getByRole("link", { name: "Harbour Night Market 2026" }).waitFor();
    await owner.getByRole("button", { name: "Restore" }).click();
    await owner.getByText("Event restored.").waitFor();
    await open(owner, `/w/${ws}/events`);
    await owner.getByRole("link", { name: "Harbour Night Market 2026" }).waitFor();
  });
  await step("delete needs confirmation, removes the event and its tasks, and the URL then 404s", async () => {
    await open(owner, `${base}/edit`);
    await owner.getByRole("button", { name: "Delete event" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Delete permanently" }).click();
    await owner.waitForURL(/events\?m=deleted/);
    await notFound(owner, base);
    await notFound(owner, `${base}/tasks`);
    await open(owner, `/w/${ws}/events`);
    await owner.getByRole("link", { name: "Lantern Showcase" }).waitFor(); // the other event is untouched
  });
} finally {
  await browser.close();
}
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
