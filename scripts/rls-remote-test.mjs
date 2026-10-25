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
  // The checks below create several events and members in this workspace; the plan limits are tested on a separate free workspace at the end.
  await admin.from("workspaces").update({ plan: "organiser" }).eq("id", ws);
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

  // guests and run of show (phase 5)
  expectDenied("guest party size above 50 rejected", await ins("guests", { event_id: evId, name: "g", party_size: 51 }), "23514");
  const gOk = await ins("guests", { event_id: evId, name: "Party of four", party_size: 4, rsvp: "confirmed", group_name: "Friends" }).select("id").single();
  record("organiser adds a guest party", !gOk.error, gOk.error?.message);
  expectEmpty("collaborator cannot change a guest's RSVP", await collab.db.from("guests").update({ rsvp: "declined" }).eq("id", gOk.data?.id).select("id"));
  expectEmpty("outsider cannot read guests", await outsider.db.from("guests").select("id").eq("event_id", evId));
  expectEmpty("outsider cannot delete a guest", await outsider.db.from("guests").delete().eq("id", gOk.data?.id).select("id"));
  expectDenied("collaborator cannot add a schedule entry", await collab.db.from("schedule_entries").insert({ workspace_id: ws, event_id: evId, title: "x", starts_at: start, ends_at: end }), "42501");
  expectDenied("schedule owner from another workspace rejected", await ins("schedule_entries", { event_id: evId, title: "x", starts_at: start, ends_at: end, owner_id: outsider.id }), "23503");
  const night = await ins("schedule_entries", { event_id: evId, title: "Pack-down", starts_at: "2026-11-14T15:00:00Z", ends_at: "2026-11-14T17:00:00Z" }).select("id").single();
  record("an overnight-style 23:00 to 01:00 (HK) entry is accepted", !night.error, night.error?.message);
  const par1 = await ins("schedule_entries", { event_id: evId, title: "Parallel A", starts_at: start, ends_at: end, owner_id: organiser.id }).select("id").single();
  const par2 = await ins("schedule_entries", { event_id: evId, title: "Parallel B", starts_at: start, ends_at: end, owner_id: organiser.id }).select("id").single();
  record("parallel entries, even with the same person, are allowed by the database", !par1.error && !par2.error);
  expectEmpty("collaborator cannot edit or delete entries", await collab.db.from("schedule_entries").update({ title: "hack" }).eq("id", par1.data?.id).select("id"));
  expectEmpty("outsider cannot read the running order", await outsider.db.from("schedule_entries").select("id").eq("event_id", evId));
  const entryDel = await collab.db.from("schedule_entries").delete().eq("id", par2.data?.id).select("id");
  record("collaborator cannot delete an entry", !entryDel.error && (entryDel.data?.length ?? 0) === 0);

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

  // --- accept quote -> budget line (migration 005) on the real database
  const evAcc = evId;
  const q2 = await ins("quotes", { event_id: evAcc, supplier_id: sup.data?.id, amount_minor: 250050, status: "shortlisted" }).select("id").single();
  expectDenied("a quote cannot be created directly as accepted", await ins("quotes", { event_id: evAcc, supplier_id: sup.data?.id, amount_minor: 1, status: "accepted" }), "42501");
  expectDenied("a quote cannot be set to accepted directly", await organiser.db.from("quotes").update({ status: "accepted" }).eq("id", q2.data?.id), "42501");
  expectDenied("collaborator cannot accept a quote", await collab.db.rpc("accept_quote", { quote: q2.data?.id }), "42501");
  expectDenied("outsider cannot accept a quote", await outsider.db.rpc("accept_quote", { quote: q2.data?.id }), "42501");
  const burst = await Promise.all(Array.from({ length: 6 }, () => organiser.db.rpc("accept_quote", { quote: q2.data?.id })));
  record("six concurrent accepts all succeed", burst.every((r) => !r.error), burst.map((r) => r.error?.code).join(","));
  record("...and all return the same budget line", new Set(burst.map((r) => r.data)).size === 1);
  const linkedRows = await admin.from("budget_items").select("id, planned_minor, committed_minor, paid_minor").eq("quote_id", q2.data?.id);
  record("exactly one line is linked, with the quote amount counted once", linkedRows.data?.length === 1 && linkedRows.data[0].committed_minor === 250050 && linkedRows.data[0].paid_minor === 0, JSON.stringify(linkedRows.data));
  const lineId = linkedRows.data?.[0]?.id;
  expectDenied("accepted line: committed amount is locked", await organiser.db.from("budget_items").update({ committed_minor: 1 }).eq("id", lineId), "P0001");
  record("accepted line: planned and paid stay editable", !(await organiser.db.from("budget_items").update({ planned_minor: 300000, paid_minor: 10000 }).eq("id", lineId)).error);
  expectDenied("accepted quote: amount is locked", await organiser.db.from("quotes").update({ amount_minor: 1 }).eq("id", q2.data?.id), "P0001");
  expectDenied("collaborator cannot re-open", await collab.db.rpc("reopen_quote", { quote: q2.data?.id }), "42501");
  record("organiser re-opens the quote", !(await organiser.db.rpc("reopen_quote", { quote: q2.data?.id })).error);
  const afterReopen = await admin.from("budget_items").select("quote_id, committed_minor").eq("id", lineId).single();
  record("re-open keeps the line (unlinked, amounts kept)", afterReopen.data?.quote_id === null && afterReopen.data?.committed_minor === 250050);
  const q3 = await ins("quotes", { event_id: evAcc, supplier_id: sup.data?.id, amount_minor: 90000 }).select("id").single();
  record("a quote can be linked to an existing line, replacing its committed amount", !(await organiser.db.rpc("accept_quote", { quote: q3.data?.id, into_item: lineId })).error
    && (await admin.from("budget_items").select("committed_minor, quote_id").eq("id", lineId).single()).data?.committed_minor === 90000);
  expectDenied("linking a different quote to a linked line is refused", await organiser.db.rpc("accept_quote", { quote: q2.data?.id, into_item: lineId }), "P0002");
  // a failed accept must leave every record exactly as it was (paid > quote amount would break paid <= committed)
  const paidLine = await ins("budget_items", { event_id: evAcc, category: "Decor", name: "Mostly paid", planned_minor: 100000, committed_minor: 100000, paid_minor: 80000 }).select("id").single();
  const q4 = await ins("quotes", { event_id: evAcc, supplier_id: sup.data?.id, amount_minor: 50000, status: "shortlisted" }).select("id").single();
  const lineBefore = (await admin.from("budget_items").select("*").eq("id", paidLine.data?.id).single()).data;
  expectDenied("accepting into a line already paid more than the quote is refused", await organiser.db.rpc("accept_quote", { quote: q4.data?.id, into_item: paidLine.data?.id }), "23514");
  const lineAfter = (await admin.from("budget_items").select("*").eq("id", paidLine.data?.id).single()).data;
  const q4After = (await admin.from("quotes").select("status").eq("id", q4.data?.id).single()).data;
  record("...and nothing changed: line identical, quote still shortlisted, no new line", JSON.stringify(lineBefore) === JSON.stringify(lineAfter) && q4After.status === "shortlisted"
    && (await admin.from("budget_items").select("id", { count: "exact", head: true }).eq("quote_id", q4.data?.id)).count === 0);
  record("accepting a quote never leaves paid above committed (new line starts at paid 0)", (await organiser.db.rpc("accept_quote", { quote: q4.data?.id })).error === null
    && (await admin.from("budget_items").select("paid_minor, committed_minor").eq("quote_id", q4.data?.id).single()).data?.paid_minor === 0);
  const noPaidAbove = await admin.from("budget_items").select("id, paid_minor, committed_minor").eq("event_id", evAcc);
  record("no budget line on the event has paid above committed", (noPaidAbove.data ?? []).every((l) => l.paid_minor <= l.committed_minor));
  record("deleting a linked line puts its quote back to shortlisted", !(await organiser.db.from("budget_items").delete().eq("id", lineId)).error
    && (await admin.from("quotes").select("status").eq("id", q3.data?.id).single()).data?.status === "shortlisted");

  // deleting an event removes its owned children (checked with the admin client, which bypasses RLS)
  const ev3 = await organiser.db.from("events").insert({ workspace_id: ws, title: "To delete", starts_at: start, ends_at: end }).select("id").single();
  await organiser.db.from("tasks").insert({ workspace_id: ws, event_id: ev3.data?.id, title: "child task" });
  await organiser.db.from("notes").insert({ workspace_id: ws, event_id: ev3.data?.id, body: "child note" });
  await organiser.db.from("guests").insert({ workspace_id: ws, event_id: ev3.data?.id, name: "child guest" });
  expectEmpty("collaborator cannot delete an event", await collab.db.from("events").delete().eq("id", ev3.data?.id).select("id"));
  record("organiser deletes the event", !(await organiser.db.from("events").delete().eq("id", ev3.data?.id)).error);
  const orphans = await Promise.all(["tasks", "notes", "guests"].map((t) => admin.from(t).select("id", { count: "exact", head: true }).eq("event_id", ev3.data?.id)));
  record("event delete cascades to tasks, notes and guests", orphans.every((o) => !o.error && o.count === 0), orphans.map((o) => o.count).join("/"));

  // --- venue fit, atomic layout save, sample event, account deletion helpers (migration 006)
  const lv = await ins("venues", { name: "Fit Hall", width_cm: 1000, depth_cm: 800 }).select("id").single();
  const smallV = await ins("venues", { name: "Tiny Hall", width_cm: 500, depth_cm: 500 }).select("id").single();
  const lev = await ins("events", { title: "Layout event", starts_at: start, ends_at: end, venue_id: lv.data?.id }).select("id").single();
  record("layout: item flush with the corner is accepted", !(await ins("layout_items", { event_id: lev.data?.id, kind: "table", label: "Corner", x_cm: 900, y_cm: 700, w_cm: 100, h_cm: 100 })).error);
  expectDenied("a venue cannot be shrunk below a layout item", await organiser.db.from("venues").update({ width_cm: 950 }).eq("id", lv.data?.id), "23514");
  expectDenied("an event cannot be attached to a venue its layout does not fit", await organiser.db.from("events").update({ venue_id: smallV.data?.id }).eq("id", lev.data?.id), "23514");
  const lay = async () => (await admin.from("layout_items").select("id, label, x_cm, updated_at").eq("event_id", lev.data?.id).order("label")).data ?? [];
  const [corner] = await lay();
  const sv = await organiser.db.rpc("save_layout", { ev: lev.data?.id, upserts: [{ id: corner.id, version: corner.updated_at, kind: "table", label: "Moved", x: 800, y: 600, w: 100, h: 100 }, { kind: "stage", label: "New stage", x: 0, y: 0, w: 300, h: 200 }], deletes: [] });
  record("save_layout applies an update and an insert together", !sv.error && sv.data === 2, sv.error?.message);
  const [moved] = await lay();
  expectDenied("a stale layout save is refused", await organiser.db.rpc("save_layout", { ev: lev.data?.id, upserts: [{ kind: "booth", label: "Must not appear", x: 0, y: 300, w: 100, h: 100 }, { id: moved.id, version: "2000-01-01T00:00:00+00:00", kind: "table", label: "Stale", x: 0, y: 0, w: 100, h: 100 }], deletes: [] }), "P0001");
  expectDenied("an out-of-bounds item rejects the whole layout save", await organiser.db.rpc("save_layout", { ev: lev.data?.id, upserts: [{ kind: "booth", label: "Fine", x: 0, y: 300, w: 100, h: 100 }, { kind: "booth", label: "Too far", x: 950, y: 0, w: 100, h: 100 }], deletes: [] }), "23514");
  record("...and nothing from the failed saves was written", (await lay()).map((i) => i.label).join() === "Moved,New stage", (await lay()).map((i) => i.label).join());
  expectDenied("collaborator cannot save a layout", await collab.db.rpc("save_layout", { ev: lev.data?.id, upserts: [], deletes: [] }), "42501");
  expectDenied("outsider cannot save a layout", await outsider.db.rpc("save_layout", { ev: lev.data?.id, upserts: [], deletes: [] }), "P0002");
  record("deleting a venue keeps the event and its layout objects", !(await organiser.db.from("venues").delete().eq("id", lv.data?.id)).error
    && (await admin.from("events").select("venue_id").eq("id", lev.data?.id).single()).data?.venue_id === null && (await lay()).length === 2);

  const countOf = async (t, e) => (await admin.from(t).select("id", { count: "exact", head: true }).eq("event_id", e)).count;
  expectDenied("collaborator cannot load the sample event", await collab.db.rpc("reset_demo", { ws }), "42501");
  expectDenied("outsider cannot load a sample event into this workspace", await outsider.db.rpc("reset_demo", { ws }), "42501");
  expectDenied("organiser cannot load a sample event into a workspace they are not in", await organiser.db.rpc("reset_demo", { ws: w2.data }), "42501");
  const d1 = await organiser.db.rpc("reset_demo", { ws });
  record("organiser loads the sample event", !d1.error && !!d1.data, d1.error?.message);
  const sampleCounts = await Promise.all(["tasks", "guests", "schedule_entries", "layout_items", "quotes", "budget_items"].map((t) => countOf(t, d1.data)));
  record("sample event is complete (8 tasks, 12 guests, 8 entries, 11 objects, 5 quotes, 5 budget lines)", sampleCounts.join() === "8,12,8,11,5,5", sampleCounts.join());
  const own = (await admin.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("demo", false)).count;
  const theirs = (await admin.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", w2.data)).count;
  const d2 = await organiser.db.rpc("reset_demo", { ws });
  record("reset replaces the sample (new event, one sample only)", !d2.error && d2.data !== d1.data && (await admin.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("demo", true)).count === 1);
  record("reset leaves the user's own events and the other workspace alone", (await admin.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("demo", false)).count === own
    && (await admin.from("events").select("id", { count: "exact", head: true }).eq("workspace_id", w2.data)).count === theirs);
  expectDenied("clients cannot set the demo flag", await ins("events", { title: "x", starts_at: start, ends_at: end, demo: true }), "42501");

  const blockers = await owner.db.rpc("account_deletion_blockers");
  record("a sole owner with other members is listed as blocked", !blockers.error && blockers.data?.some((b) => b.workspace_id === ws), JSON.stringify(blockers.data));
  record("a member who is not the sole owner is not blocked", ((await organiser.db.rpc("account_deletion_blockers")).data ?? []).length === 0);
  record("remove_my_sole_workspaces removes nothing while others are members", (await owner.db.rpc("remove_my_sole_workspaces")).data === 0);
  record("a user who is the only member has their workspace removed", (await outsider.db.rpc("remove_my_sole_workspaces")).data === 1
    && (await admin.from("workspaces").select("id", { count: "exact", head: true }).eq("id", w2.data)).count === 0);
  workspaces.splice(workspaces.indexOf(w2.data), 1);

  // --- sandbox entitlements and plan limits (migration 007), on a fresh FREE workspace
  const k = (n) => `remote-${run}-${n}-0123456789`;
  // Migration 008: the sandbox functions are executable only with the server's secret key; the app passes the verified user as `actor`.
  const co = (actor, args) => admin.rpc("sandbox_checkout", { actor, ...args });
  const ce = (actor, wsId) => admin.rpc("sandbox_end_organiser", { actor, ws: wsId });
  const probe = await co(owner.id, { ws, plan_id: "enterprise", ev: null, outcome: "success", idem: k("probe") });
  const oldOne = await owner.db.rpc("sandbox_checkout", { ws, plan_id: "enterprise", ev: null, outcome: "success", idem: k("old") });
  if (probe.error?.code === "PGRST202") {
    console.log("SKIP migration 008 checks: the server-only sandbox functions do not exist yet (apply migrations 007 and 008, then rerun)");
    record("migration 008 applied: signed-in users can no longer call the 007 sandbox function directly", oldOne.error?.code === "PGRST202", oldOne.error ? oldOne.error.code : "an owner can still call sandbox_checkout through the API, bypassing PAYMENT_SANDBOX_ENABLED");
  } else {
    for (const who of ["owner", "organiser", "collab", "outsider"]) {
      const legacyEnd = await users[who].db.rpc("sandbox_end_organiser", { ws });
      record(`${who}: the legacy one-argument sandbox_end_organiser no longer exists`, legacyEnd.error?.code === "PGRST202", legacyEnd.error?.code ?? "callable");
    }
    record("the old directly callable sandbox function is gone", oldOne.error?.code === "PGRST202", oldOne.error?.code ?? "still callable");
    await makeUser("extra");
    const wf = (await owner.db.rpc("create_workspace", { ws_name: `RLS free ${run}` })).data;
    workspaces.push(wf);
    const wlog = async () => (await admin.from("entitlement_events").select("id", { count: "exact", head: true }).eq("workspace_id", wf)).count;
    const wplan = async () => (await admin.from("workspaces").select("plan").eq("id", wf).single()).data?.plan;
    const upgraded = async () => ((await admin.from("events").select("id").eq("workspace_id", wf).eq("event_upgrade", true)).data ?? []).map((r) => r.id);
    const mkEvent = (db, title) => db.from("events").insert({ workspace_id: wf, title, starts_at: start, ends_at: end }).select("id").single();
    await owner.db.rpc("add_workspace_member", { ws: wf, member_email: organiser.email, member_role: "organiser" });
    await owner.db.rpc("add_workspace_member", { ws: wf, member_email: collab.email, member_role: "collaborator" });
    const e1 = await mkEvent(organiser.db, "Free event one");
    record("free workspace: the first active event is accepted", !e1.error, e1.error?.message);
    expectDenied("free workspace: a second active event is refused", await mkEvent(organiser.db, "Free event two"), "53400");
    expectDenied("free workspace: a fourth member is refused", await owner.db.rpc("add_workspace_member", { ws: wf, member_email: outsider.email, member_role: "collaborator" }), "53400");
    expectDenied("free workspace: adding an existing member at the limit reports the duplicate, not the plan limit", await owner.db.rpc("add_workspace_member", { ws: wf, member_email: organiser.email, member_role: "organiser" }), "23505");
    expectDenied("the event upgrade cannot be written directly", await owner.db.from("events").update({ event_upgrade: true }).eq("id", e1.data?.id), "42501");
    expectDenied("the entitlement log cannot be written directly", await owner.db.from("entitlement_events").insert({ workspace_id: wf, plan: "organiser", outcome: "success", idempotency_key: k("forge") }), "42501");
    for (const who of ["organiser", "collab", "outsider"]) {
      expectDenied(`${who} cannot run a checkout`, await co(users[who].id, { ws: wf, plan_id: "organiser", ev: null, outcome: "success", idem: k(`deny-${who}`) }), "42501");
      expectDenied(`${who} cannot end the Organiser plan`, await ce(users[who].id, wf), "42501");
    }
    // Direct API calls with a real session or the public key must fail on privilege alone, even for the workspace owner.
    for (const [who, db] of [["owner", owner.db], ["organiser", organiser.db], ["anonymous visitor", anon]]) {
      expectDenied(`${who} cannot call sandbox_checkout through the API`, await db.rpc("sandbox_checkout", { actor: owner.id, ws: wf, plan_id: "organiser", ev: null, outcome: "success", idem: k(`direct-${who.length}`) }), "42501");
      expectDenied(`${who} cannot call sandbox_end_organiser through the API`, await db.rpc("sandbox_end_organiser", { actor: owner.id, ws: wf }), "42501");
    }
    expectDenied("anonymous cannot run a checkout", await co(null, { ws: wf, plan_id: "organiser", ev: null, outcome: "success", idem: k("anon") }), "42501");
    record("denied attempts changed nothing", (await wplan()) === "free" && (await wlog()) === 0 && (await upgraded()).length === 0);
    let badN = 0;
    const bad = async (name, args, code) => expectDenied(name, await co(owner.id, { ws: wf, ev: null, outcome: "success", idem: k(`bad${badN++}`), ...args }), code);
    await bad("unknown plan is rejected", { plan_id: "enterprise" }, "22023");
    await bad("the free plan id is not sellable", { plan_id: "free" }, "22023");
    await bad("an unknown outcome is rejected", { plan_id: "organiser", outcome: "paid" }, "22023");
    await bad("a malformed request key is rejected", { plan_id: "organiser", idem: "short" }, "22023");
    await bad("the event plan needs an event", { plan_id: "event" }, "22023");
    await bad("the organiser plan takes no event", { plan_id: "organiser", ev: e1.data?.id }, "22023");
    await bad("an event of another workspace is rejected", { plan_id: "event", ev: (await admin.from("events").select("id").eq("workspace_id", ws).limit(1)).data[0].id }, "P0002");
    record("tampered requests changed and logged nothing", (await wplan()) === "free" && (await wlog()) === 0 && (await upgraded()).length === 0);
    const can = await co(owner.id, { ws: wf, plan_id: "organiser", ev: null, outcome: "cancelled", idem: k("cancel") });
    const fail = await co(owner.id, { ws: wf, plan_id: "event", ev: e1.data?.id, outcome: "failed", idem: k("fail") });
    record("cancelled and failed checkouts are logged and grant nothing", !can.error && !fail.error && (await wlog()) === 2 && (await wplan()) === "free" && (await upgraded()).length === 0);
    const ok1 = await co(owner.id, { ws: wf, plan_id: "event", ev: e1.data?.id, outcome: "success", idem: k("event") });
    record("owner upgrades one event (success)", !ok1.error && ok1.data?.outcome === "success" && ok1.data?.replayed === false && (await upgraded()).join() === e1.data?.id, ok1.error?.message);
    const rep = await co(owner.id, { ws: wf, plan_id: "event", ev: e1.data?.id, outcome: "failed", idem: k("event") });
    record("repeating the request key replays the first outcome and writes nothing", !rep.error && rep.data?.replayed === true && rep.data?.outcome === "success" && (await wlog()) === 3);
    expectDenied("a fresh key cannot upgrade the same event twice", await co(owner.id, { ws: wf, plan_id: "event", ev: e1.data?.id, outcome: "success", idem: k("event2") }), "P0001");
    expectDenied("a request key cannot be reused for another plan", await co(owner.id, { ws: wf, plan_id: "organiser", ev: null, outcome: "success", idem: k("event") }), "22023");
    const cr = await co(owner.id, { ws: wf, plan_id: "organiser", ev: null, outcome: "success", idem: k("cancel") });
    record("a cancelled key can never be turned into a success", !cr.error && cr.data?.outcome === "cancelled" && (await wplan()) === "free");
    record("the upgraded workspace allows up to ten members (a fourth is now accepted)", !(await owner.db.rpc("add_workspace_member", { ws: wf, member_email: outsider.email, member_role: "collaborator" })).error);
    expectDenied("the events limit is unchanged by an event upgrade", await mkEvent(organiser.db, "Free event two"), "53400");
    expectEmpty("only owners can read the entitlement log", await organiser.db.from("entitlement_events").select("id").eq("workspace_id", wf));
    const own = await owner.db.from("entitlement_events").select("id").eq("workspace_id", wf);
    record("the owner can read the entitlement log", !own.error && own.data.length === 3, own.error?.message);
    const org = await co(owner.id, { ws: wf, plan_id: "organiser", ev: null, outcome: "success", idem: k("org") });
    record("owner starts the test Organiser plan", !org.error && (await wplan()) === "organiser", org.error?.message);
    expectDenied("Organiser cannot be bought twice", await co(owner.id, { ws: wf, plan_id: "organiser", ev: null, outcome: "success", idem: k("org2") }), "P0001");
    record("Organiser removes the event limit", !(await mkEvent(organiser.db, "Free event two")).error);
    const end2 = await ce(owner.id, wf);
    record("owner ends the test Organiser plan; the event upgrade stays", !end2.error && end2.data === true && (await wplan()) === "free" && (await upgraded()).join() === e1.data?.id, end2.error?.message);
    record("the other workspace's log is untouched", (await admin.from("entitlement_events").select("id", { count: "exact", head: true }).eq("workspace_id", ws)).count === 0);
    // --- downgrade: returning to Free keeps every record and member and applies the limits to new additions only
    const wd = (await owner.db.rpc("create_workspace", { ws_name: `RLS downgrade ${run}` })).data;
    workspaces.push(wd);
    const nOf = async (t, extra = {}) => { let q = admin.from(t).select("*", { count: "exact", head: true }).eq("workspace_id", wd); for (const [c, v] of Object.entries(extra)) q = v === null ? q.is(c, null) : q.eq(c, v); return (await q).count; };
    const dEvent = (db, title) => db.from("events").insert({ workspace_id: wd, title, starts_at: start, ends_at: end }).select("id").single();
    record("downgrade: the workspace goes Organiser", !(await co(owner.id, { ws: wd, plan_id: "organiser", ev: null, outcome: "success", idem: k("down-org") })).error);
    for (const [u, role] of [[organiser, "organiser"], [collab, "collaborator"], [outsider, "collaborator"]]) await owner.db.rpc("add_workspace_member", { ws: wd, member_email: u.email, member_role: role });
    const d1 = await dEvent(organiser.db, "Kept one");
    const d2 = await dEvent(organiser.db, "Kept two");
    record("downgrade: Organiser holds 4 members and 2 active events", (await nOf("workspace_members")) === 4 && !d1.error && !d2.error && (await nOf("events", { archived_at: null })) === 2);
    const down = await ce(owner.id, wd);
    record("downgrade: the owner returns the workspace to Free", !down.error && down.data === true);
    record("downgrade: no member or event was removed or archived", (await nOf("workspace_members")) === 4 && (await nOf("events")) === 2 && (await nOf("events", { archived_at: null })) === 2);
    record("downgrade: existing records can still be edited", !(await organiser.db.from("events").update({ title: "Kept one, edited" }).eq("id", d1.data?.id).select("id")).error);
    expectDenied("downgrade: a new event is refused while two are active", await dEvent(organiser.db, "New one"), "53400");
    expectDenied("downgrade: a new member is refused while there are four", await owner.db.rpc("add_workspace_member", { ws: wd, member_email: users.extra.email, member_role: "collaborator" }), "53400");
    await organiser.db.from("events").update({ archived_at: new Date().toISOString() }).eq("id", d2.data?.id);
    expectDenied("downgrade: one active event is still the limit", await dEvent(organiser.db, "New one"), "53400");
    await organiser.db.from("events").update({ archived_at: new Date().toISOString() }).eq("id", d1.data?.id);
    record("downgrade: with none active, one new event is allowed", !(await dEvent(organiser.db, "New one")).error);
    await owner.db.rpc("remove_member", { ws: wd, target: outsider.id });
    expectDenied("downgrade: three members is the free limit, so a new one is still refused", await owner.db.rpc("add_workspace_member", { ws: wd, member_email: users.extra.email, member_role: "collaborator" }), "53400");
    await owner.db.rpc("remove_member", { ws: wd, target: collab.id });
    record("downgrade: below the limit, a member can be added again", !(await owner.db.rpc("add_workspace_member", { ws: wd, member_email: users.extra.email, member_role: "collaborator" })).error);
    record("the downgrade test workspace is deleted", !(await owner.db.rpc("delete_workspace", { ws: wd })).error);
    workspaces.splice(workspaces.indexOf(wd), 1);
    record("the free test workspace is deleted", !(await owner.db.rpc("delete_workspace", { ws: wf })).error);
    workspaces.splice(workspaces.indexOf(wf), 1);
  }

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
