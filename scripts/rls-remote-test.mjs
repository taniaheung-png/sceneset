// End-to-end access test against the REAL Supabase DEVELOPMENT project (migrations must be applied).
// Creates throw-away confirmed users with the secret key (email confirmation stays ON for the project),
// signs them in with the publishable key, attempts forbidden operations through the public API, then cleans up.
//
//   RLS_TEST_CONFIRM=dev-project npm run test:remote
//
// NEVER point this at a project that holds real data. It prints no keys.
import { createClient } from "@supabase/supabase-js";

if (process.env.RLS_TEST_CONFIRM !== "dev-project") {
  console.error("Refusing to run. Set RLS_TEST_CONFIRM=dev-project to confirm this is a development project.");
  process.exit(2);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sec = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !pub || !sec) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, a publishable key, or a secret key in the environment.");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, sec, opts);
const run = Date.now().toString(36);
const password = `Rls-${run}-${Math.random().toString(36).slice(2)}!`;
const users = {};
const workspaces = [];
let failed = 0;
const results = [];

const record = (name, ok, detail = "") => {
  results.push({ name, ok });
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — ${detail}`}`);
};
const expectDenied = (name, { error }, code) => record(name, !!error && (!code || error.code === code), `got ${error ? error.code : "success"}`);
const expectEmpty = (name, { data, error }) => record(name, !error && (data?.length ?? 0) === 0, error ? error.code : `${data?.length} rows`);

async function makeUser(tag) {
  const email = `rls-${tag}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `Test ${tag}` } });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  const client = createClient(url, pub, opts);
  const s = await client.auth.signInWithPassword({ email, password });
  if (s.error) throw new Error(`signIn ${tag}: ${s.error.message}`);
  users[tag] = { id: data.user.id, email, db: client };
}

try {
  const anon = createClient(url, pub, opts);
  for (const t of ["profiles", "workspaces", "workspace_members", "events", "tasks", "budget_items"]) {
    const r = await anon.from(t).select("*").limit(1);
    expectDenied(`anon cannot read ${t}`, r, "42501");
  }
  expectDenied("anon cannot call create_workspace", await anon.rpc("create_workspace", { ws_name: "x" }));

  for (const t of ["owner", "organiser", "collab", "outsider"]) await makeUser(t);
  const { owner, organiser, collab, outsider } = users;

  const w1 = await owner.db.rpc("create_workspace", { ws_name: `RLS test ${run}` });
  record("owner creates workspace", !w1.error && !!w1.data, w1.error?.message);
  const ws = w1.data;
  workspaces.push(ws);
  const w2 = await outsider.db.rpc("create_workspace", { ws_name: `RLS other ${run}` });
  workspaces.push(w2.data);

  record("owner adds organiser", !(await owner.db.rpc("add_workspace_member", { ws, member_email: organiser.email.toUpperCase(), member_role: "organiser" })).error);
  record("owner adds collaborator", !(await owner.db.rpc("add_workspace_member", { ws, member_email: collab.email, member_role: "collaborator" })).error);

  expectDenied("organiser cannot add members", await organiser.db.rpc("add_workspace_member", { ws, member_email: outsider.email, member_role: "collaborator" }), "42501");
  expectDenied("collaborator cannot promote themself", await collab.db.rpc("set_member_role", { ws, target: collab.id, new_role: "owner" }), "42501");
  expectDenied("no direct role update", await collab.db.from("workspace_members").update({ role: "owner" }).eq("user_id", collab.id), "42501");
  expectDenied("no direct member insert", await collab.db.from("workspace_members").insert({ workspace_id: ws, user_id: outsider.id, role: "owner" }), "42501");
  expectDenied("last owner cannot be demoted", await owner.db.rpc("set_member_role", { ws, target: owner.id, new_role: "organiser" }), "P0001");
  expectDenied("last owner cannot leave", await owner.db.rpc("remove_member", { ws, target: owner.id }), "P0001");
  expectDenied("plan is not client-writable", await owner.db.from("workspaces").update({ plan: "organiser" }).eq("id", ws), "42501");
  expectEmpty("outsider sees no members of the workspace", await outsider.db.from("workspace_members").select("*").eq("workspace_id", ws));
  expectEmpty("outsider cannot rename it", await outsider.db.from("workspaces").update({ name: "pwned" }).eq("id", ws).select("id"));
  const names = await outsider.db.from("workspaces").select("id");
  record("outsider sees only their own workspace", !names.error && names.data.length === 1 && names.data[0].id === w2.data);
  const ml = await collab.db.rpc("list_workspace_members", { ws });
  record("member list hides emails from non-owners", !ml.error && ml.data.length === 3 && ml.data.every((m) => m.email === null));

  const start = "2026-11-14T10:00:00Z", end = "2026-11-14T18:00:00Z";
  const ev = await organiser.db.from("events").insert({ workspace_id: ws, title: "RLS event", starts_at: start, ends_at: end }).select("id").single();
  record("organiser creates event", !ev.error, ev.error?.message);
  expectDenied("collaborator cannot create event", await collab.db.from("events").insert({ workspace_id: ws, title: "x", starts_at: start, ends_at: end }), "42501");
  expectDenied("organiser cannot create event in a workspace they are not in", await organiser.db.from("events").insert({ workspace_id: w2.data, title: "x", starts_at: start, ends_at: end }), "42501");
  expectEmpty("outsider cannot read the event", await outsider.db.from("events").select("id").eq("id", ev.data?.id));
  expectDenied("event_upgrade is not client-writable", await organiser.db.from("events").update({ event_upgrade: true }).eq("id", ev.data?.id), "42501");
  expectDenied("task assignee from another workspace is rejected", await organiser.db.from("tasks").insert({ workspace_id: ws, event_id: ev.data?.id, title: "t", assignee_id: outsider.id }), "23503");
  const t1 = await organiser.db.from("tasks").insert({ workspace_id: ws, event_id: ev.data?.id, title: "Book PA", assignee_id: collab.id }).select("id").single();
  const cs = await collab.db.from("tasks").update({ status: "in_progress" }).eq("id", t1.data?.id).select("id");
  record("collaborator updates status of own task", !cs.error && cs.data.length === 1, cs.error?.message);
  expectDenied("collaborator cannot edit task title", await collab.db.from("tasks").update({ title: "renamed" }).eq("id", t1.data?.id), "42501");
  expectDenied("collaborator cannot write budget", await collab.db.from("budget_items").insert({ workspace_id: ws, event_id: ev.data?.id, category: "x", name: "x" }), "42501");
  expectDenied("budget paid cannot exceed committed", await organiser.db.from("budget_items").insert({ workspace_id: ws, event_id: ev.data?.id, category: "x", name: "x", committed_minor: 1, paid_minor: 2 }), "23514");

  // --- constraints and cross-workspace links (P2.6 to P2.11) on the real database
  const evId = ev.data?.id;
  const ins = (t, row) => organiser.db.from(t).insert({ workspace_id: ws, ...row });
  expectDenied("event end must be after start", await ins("events", { title: "bad", starts_at: end, ends_at: start }), "23514");
  expectDenied("negative budget target rejected", await ins("events", { title: "bad", starts_at: start, ends_at: end, budget_target_minor: -1 }), "23514");
  expectDenied("unknown timezone rejected", await ins("events", { title: "bad", starts_at: start, ends_at: end, timezone: "Mars/Base" }), "22023");
  expectDenied("guest party size 0 rejected", await ins("guests", { event_id: evId, name: "g", party_size: 0 }), "23514");
  expectDenied("guest unknown RSVP rejected", await ins("guests", { event_id: evId, name: "g", rsvp: "maybe" }), "23514");
  expectDenied("schedule end must be after start", await ins("schedule_entries", { event_id: evId, title: "s", starts_at: end, ends_at: start }), "23514");
  expectDenied("collaborator cannot add guests", await collab.db.from("guests").insert({ workspace_id: ws, event_id: evId, name: "g" }), "42501");

  const otherSup = await outsider.db.from("suppliers").insert({ workspace_id: w2.data, name: "Theirs" }).select("id").single();
  expectDenied("quote with a supplier from another workspace rejected", await ins("quotes", { event_id: evId, supplier_id: otherSup.data?.id, amount_minor: 1 }), "23503");
  const sup = await organiser.db.from("suppliers").insert({ workspace_id: ws, name: "Lantern Co", category: "decor" }).select("id").single();
  const quote = await ins("quotes", { event_id: evId, supplier_id: sup.data?.id, amount_minor: 120000 }).select("id").single();
  record("organiser records a quote", !quote.error, quote.error?.message);
  // Postgres reports a blocked RESTRICT delete as 23001 or 23503 depending on version; either means "blocked".
  const supDel = await organiser.db.from("suppliers").delete().eq("id", sup.data?.id);
  record("supplier with quotes cannot be deleted", ["23001", "23503"].includes(supDel.error?.code), `got ${supDel.error?.code ?? "success"}`);
  expectDenied("negative quote amount rejected", await ins("quotes", { event_id: evId, supplier_id: sup.data?.id, amount_minor: -5 }), "23514");
  expectDenied("budget quote link is not client-writable", await ins("budget_items", { event_id: evId, category: "decor", name: "L", quote_id: quote.data?.id }), "42501");

  const otherVenue = await outsider.db.from("venues").insert({ workspace_id: w2.data, name: "Theirs", width_cm: 500, depth_cm: 500 }).select("id").single();
  expectDenied("venue from another workspace cannot be attached", await organiser.db.from("events").update({ venue_id: otherVenue.data?.id }).eq("id", evId), "23503");
  const item = { event_id: evId, kind: "table", label: "T1", x_cm: 900, y_cm: 700, w_cm: 100, h_cm: 100 };
  expectDenied("layout needs a venue first", await ins("layout_items", item), "23514");
  const venue = await organiser.db.from("venues").insert({ workspace_id: ws, name: "Pier 9", width_cm: 1000, depth_cm: 800 }).select("id").single();
  record("organiser attaches own venue", !(await organiser.db.from("events").update({ venue_id: venue.data?.id }).eq("id", evId)).error);
  record("layout item flush with the corner is accepted", !(await ins("layout_items", item)).error);
  expectDenied("layout item outside the venue rejected", await ins("layout_items", { ...item, x_cm: 901 }), "23514");
  record("deleting a venue keeps the event", !(await organiser.db.from("venues").delete().eq("id", venue.data?.id)).error
    && (await organiser.db.from("events").select("venue_id").eq("id", evId).single()).data?.venue_id === null);

  // notes, cross-tenant delete and aggregates, and the unique quote link (admin client bypasses RLS to hit the constraint itself)
  expectDenied("empty note rejected", await organiser.db.from("notes").insert({ workspace_id: ws, event_id: evId, body: "  " }), "23514");
  const cn = await collab.db.from("notes").insert({ workspace_id: ws, event_id: evId, body: "hello" }).select("id").single();
  record("collaborator adds own note", !cn.error, cn.error?.message);
  expectDenied("collaborator cannot spoof note author", await collab.db.from("notes").insert({ workspace_id: ws, event_id: evId, body: "x", author_id: organiser.id }), "42501");
  expectEmpty("outsider cannot edit someone else's note", await outsider.db.from("notes").update({ body: "pwned" }).eq("id", cn.data?.id).select("id"));
  expectEmpty("outsider cannot delete the event", await outsider.db.from("events").delete().eq("id", evId).select("id"));
  expectEmpty("outsider cannot delete tasks", await outsider.db.from("tasks").delete().eq("event_id", evId).select("id"));
  const cnt = await outsider.db.from("guests").select("*", { count: "exact", head: true }).eq("event_id", evId);
  record("outsider aggregate count of guests is 0", !cnt.error && cnt.count === 0, cnt.error?.code ?? `count ${cnt.count}`);
  const b1 = await admin.from("budget_items").insert({ workspace_id: ws, event_id: evId, category: "decor", name: "A", quote_id: quote.data?.id });
  const b2 = await admin.from("budget_items").insert({ workspace_id: ws, event_id: evId, category: "decor", name: "B", quote_id: quote.data?.id });
  record("one quote can be linked to only one budget item", !b1.error && b2.error?.code === "23505", `${b1.error?.code} / ${b2.error?.code}`);

  expectDenied("entitlement log cannot be written by clients", await owner.db.from("entitlement_events").insert({ workspace_id: ws, plan: "organiser", outcome: "success", idempotency_key: `k-${run}` }), "42501");
  expectEmpty("non-owner sees no entitlement log", await organiser.db.from("entitlement_events").select("*").eq("workspace_id", ws));

  record("owner deletes workspace (cascade)", !(await owner.db.rpc("delete_workspace", { ws })).error);
  workspaces.splice(0, 1);
  expectEmpty("deleted workspace is gone for members", await organiser.db.from("workspaces").select("id").eq("id", ws));
} catch (e) {
  failed++;
  console.error("ABORTED:", e.message);
} finally {
  for (const ws of workspaces) if (ws) await users.outsider?.db.rpc("delete_workspace", { ws });
  for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  console.log(`\nCleaned up ${Object.keys(users).length} test users.`);
}
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed${failed ? `, ${failed} problem(s)` : ""}`);
process.exit(failed ? 1 : 0);
