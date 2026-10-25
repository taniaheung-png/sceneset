// Local SQL test: applies the real migrations to an in-process Postgres (PGlite) with a minimal
// shim of Supabase's `auth` schema and roles, then exercises RLS/constraints as different users.
// This verifies the SQL logic only. It does NOT replace testing against the real Supabase dev
// project (see scripts/rls-remote-test.mjs); that gate stays unticked until it has actually run.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { before, describe, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const dir = new URL("../migrations/", import.meta.url);

const SHIM = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email varchar(255),
                           raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase grants new public tables to these roles by default; reproduce that so our REVOKEs are tested.
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

/** Run one statement as a role/user in its own transaction. Returns { rows } or { error: {code, message} }. */
async function as(uid, sql, params = []) {
  try {
    return await db.transaction(async (tx) => {
      await tx.query(`set local role ${uid ? "authenticated" : "anon"}`);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
      return { rows: (await tx.query(sql, params)).rows };
    });
  } catch (e) {
    return { error: { code: e.code, message: e.message } };
  }
}
const ok = (r) => assert.equal(r.error, undefined, JSON.stringify(r.error));
const denied = (r, code) => {
  assert.ok(r.error, "expected an error but the statement succeeded");
  if (code) assert.equal(r.error.code, code, r.error.message);
};
const none = (r) => (ok(r), assert.equal(r.rows.length, 0));

const U = {};
let ws1, ws2, ev1, ev2, venue;

before(async () => {
  await db.exec(SHIM);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(f, dir), "utf8"));
  }
  for (const n of ["alice", "bob", "carol", "dave"]) {
    U[n] = (await db.query("insert into auth.users (email) values ($1) returning id", [`${n}@example.test`])).rows[0].id;
  }
  ws1 = (await as(U.alice, "select public.create_workspace('Alice Events') as id")).rows[0].id;
  ws2 = (await as(U.dave, "select public.create_workspace('Dave Co') as id")).rows[0].id;
  ok(await as(U.alice, "select public.add_workspace_member($1,'BOB@example.test','organiser')", [ws1]));
  ok(await as(U.alice, "select public.add_workspace_member($1,'carol@example.test','collaborator')", [ws1]));
});

describe("anonymous and outsiders", () => {
  test("anon cannot read any table", async () => {
    for (const t of ["profiles", "workspaces", "workspace_members", "events", "tasks", "budget_items", "guests"]) {
      denied(await as(null, `select * from public.${t}`), "42501");
    }
  });
  test("anon cannot call RPCs", async () => {
    denied(await as(null, "select public.create_workspace('x')"), "42501");
  });
  test("outsider sees only own workspace and no foreign events", async () => {
    const r = await as(U.dave, "select id from public.workspaces");
    assert.deepEqual(r.rows.map((x) => x.id), [ws2]);
    none(await as(U.dave, "select * from public.workspace_members where workspace_id = $1", [ws1]));
  });
});

describe("roles and membership", () => {
  test("only owners manage members", async () => {
    denied(await as(U.bob, "select public.add_workspace_member($1,'dave@example.test','collaborator')", [ws1]), "42501");
    denied(await as(U.carol, "select public.set_member_role($1,$2,'owner')", [ws1, U.carol]), "42501");
  });
  test("no direct DML on workspace_members", async () => {
    denied(await as(U.carol, "update public.workspace_members set role='owner' where user_id=$1", [U.carol]), "42501");
    denied(await as(U.carol, "insert into public.workspace_members values ($1,$2,'owner')", [ws1, U.dave]), "42501");
    denied(await as(U.carol, "delete from public.workspace_members where user_id=$1", [U.alice]), "42501");
  });
  test("unknown email and duplicate member are rejected", async () => {
    denied(await as(U.alice, "select public.add_workspace_member($1,'ghost@example.test','organiser')", [ws1]), "P0002");
    denied(await as(U.alice, "select public.add_workspace_member($1,'bob@example.test','organiser')", [ws1]), "23505");
  });
  test("last owner cannot be demoted or removed; a second owner unlocks it", async () => {
    denied(await as(U.alice, "select public.set_member_role($1,$2,'organiser')", [ws1, U.alice]), "P0001");
    denied(await as(U.alice, "select public.remove_member($1,$2)", [ws1, U.alice]), "P0001");
    ok(await as(U.alice, "select public.set_member_role($1,$2,'owner')", [ws1, U.bob]));
    ok(await as(U.alice, "select public.set_member_role($1,$2,'organiser')", [ws1, U.alice]));
    ok(await as(U.bob, "select public.set_member_role($1,$2,'owner')", [ws1, U.alice]));
    ok(await as(U.alice, "select public.set_member_role($1,$2,'organiser')", [ws1, U.bob])); // bob back to organiser
    const r = await as(U.alice, "select role from public.workspace_members where user_id=$1 and workspace_id=$2", [U.alice, ws1]);
    assert.equal(r.rows[0].role, "owner");
  });
  test("member list hides emails from non-owners", async () => {
    const o = await as(U.alice, "select email from public.list_workspace_members($1)", [ws1]);
    assert.ok(o.rows.every((x) => x.email));
    const c = await as(U.carol, "select email from public.list_workspace_members($1)", [ws1]);
    assert.equal(c.rows.length, 3);
    assert.ok(c.rows.every((x) => x.email === null));
    none(await as(U.dave, "select * from public.list_workspace_members($1)", [ws1]));
  });
  test("workspace rename is owner-only; plan is not client-writable", async () => {
    denied(await as(U.alice, "update public.workspaces set plan='organiser' where id=$1", [ws1]), "42501");
    none(await as(U.bob, "update public.workspaces set name='Hacked' where id=$1 returning id", [ws1]));
    assert.equal((await as(U.alice, "update public.workspaces set name='Alice Events' where id=$1 returning id", [ws1])).rows.length, 1);
  });
});

describe("event data isolation and permissions", () => {
  const T = "2026-11-14T10:00:00Z", T2 = "2026-11-14T18:00:00Z";
  const evSql = "insert into public.events (workspace_id,title,starts_at,ends_at) values ($1,'Night Market',$2,$3) returning id";

  test("organiser creates; collaborator and outsider cannot", async () => {
    const r = await as(U.bob, evSql, [ws1, T, T2]);
    ok(r);
    ev1 = r.rows[0].id;
    denied(await as(U.carol, evSql, [ws1, T, T2]), "42501");
    denied(await as(U.dave, evSql, [ws1, T, T2]), "42501");
    denied(await as(U.bob, evSql, [ws2, T, T2]), "42501"); // forged workspace id
    ev2 = (await as(U.dave, evSql, [ws2, T, T2])).rows[0].id;
  });
  test("reads are tenant-scoped", async () => {
    assert.equal((await as(U.carol, "select id from public.events")).rows.length, 1);
    none(await as(U.dave, "select * from public.events where id=$1", [ev1]));
    none(await as(U.bob, "select * from public.events where id=$1", [ev2]));
  });
  test("cross-workspace and invalid values are rejected by the database", async () => {
    denied(await as(U.bob, "insert into public.tasks (workspace_id,event_id,title) values ($1,$2,'x')", [ws1, ev2]), "23503");
    denied(await as(U.bob, "insert into public.tasks (workspace_id,event_id,title,assignee_id) values ($1,$2,'x',$3)", [ws1, ev1, U.dave]), "23503");
    denied(await as(U.bob, evSql, [ws1, T2, T]), "23514"); // ends before start
    denied(await as(U.bob, "insert into public.events (workspace_id,title,starts_at,ends_at,timezone) values ($1,'t',$2,$3,'Mars/Base')", [ws1, T, T2]), "22023");
    denied(await as(U.bob, "insert into public.events (workspace_id,title,starts_at,ends_at,budget_target_minor) values ($1,'t',$2,$3,-1)", [ws1, T, T2]), "23514");
  });
  test("event_upgrade is not client-writable", async () => {
    denied(await as(U.bob, "update public.events set event_upgrade=true where id=$1", [ev1]), "42501");
    denied(await as(U.bob, "insert into public.events (workspace_id,title,starts_at,ends_at,event_upgrade) values ($1,'t',$2,$3,true)", [ws1, T, T2]), "42501");
  });
  test("collaborator may change only status of own assigned task", async () => {
    const mine = (await as(U.bob, "insert into public.tasks (workspace_id,event_id,title,assignee_id) values ($1,$2,'Book PA',$3) returning id", [ws1, ev1, U.carol])).rows[0].id;
    const other = (await as(U.bob, "insert into public.tasks (workspace_id,event_id,title) values ($1,$2,'Print signs') returning id", [ws1, ev1])).rows[0].id;
    assert.equal((await as(U.carol, "update public.tasks set status='in_progress' where id=$1 returning id", [mine])).rows.length, 1);
    denied(await as(U.carol, "update public.tasks set title='renamed' where id=$1", [mine]), "42501");
    denied(await as(U.carol, "update public.tasks set assignee_id=null where id=$1", [mine]), "42501");
    none(await as(U.carol, "update public.tasks set status='done' where id=$1 returning id", [other]));
    denied(await as(U.carol, "insert into public.tasks (workspace_id,event_id,title) values ($1,$2,'x')", [ws1, ev1]), "42501");
    none(await as(U.carol, "delete from public.tasks where id=$1 returning id", [mine]));
  });
  test("notes: members add own; edit only own unless organiser/owner", async () => {
    const n = await as(U.carol, "insert into public.notes (workspace_id,event_id,body) values ($1,$2,'hello') returning id", [ws1, ev1]);
    ok(n);
    denied(await as(U.carol, "insert into public.notes (workspace_id,event_id,body,author_id) values ($1,$2,'spoof',$3)", [ws1, ev1, U.bob]), "42501");
    const b = (await as(U.bob, "insert into public.notes (workspace_id,event_id,body) values ($1,$2,'bob note') returning id", [ws1, ev1])).rows[0].id;
    none(await as(U.carol, "update public.notes set body='x' where id=$1 returning id", [b]));
    assert.equal((await as(U.bob, "update public.notes set body='edited' where id=$1 returning id", [n.rows[0].id])).rows.length, 1);
  });
});

describe("suppliers, quotes, budget", () => {
  let sup, quote;
  test("collaborator cannot write; organiser can", async () => {
    denied(await as(U.carol, "insert into public.suppliers (workspace_id,name) values ($1,'x')", [ws1]), "42501");
    sup = (await as(U.bob, "insert into public.suppliers (workspace_id,name,category) values ($1,'Lantern Co','decor') returning id", [ws1])).rows[0].id;
    quote = (await as(U.bob, "insert into public.quotes (workspace_id,event_id,supplier_id,amount_minor) values ($1,$2,$3,120000) returning id", [ws1, ev1, sup])).rows[0].id;
    none(await as(U.carol, "update public.quotes set status='accepted' where id=$1 returning id", [quote])); // RLS hides the row
  });
  test("forged supplier from another workspace is rejected", async () => {
    const foreign = (await as(U.dave, "insert into public.suppliers (workspace_id,name) values ($1,'Theirs') returning id", [ws2])).rows[0].id;
    denied(await as(U.bob, "insert into public.quotes (workspace_id,event_id,supplier_id,amount_minor) values ($1,$2,$3,1)", [ws1, ev1, foreign]), "23503");
  });
  test("supplier with quotes cannot be deleted", async () => {
    denied(await as(U.bob, "delete from public.suppliers where id=$1", [sup]), "23001");
  });
  test("budget constraints; quote link is not client-writable", async () => {
    const ins = "insert into public.budget_items (workspace_id,event_id,category,name,planned_minor,committed_minor,paid_minor) values ($1,$2,'decor','Lanterns',$3,$4,$5)";
    ok(await as(U.bob, ins, [ws1, ev1, 100000, 120000, 50000]));
    denied(await as(U.bob, ins, [ws1, ev1, 100000, 120000, 130000]), "23514"); // paid > committed
    denied(await as(U.bob, ins, [ws1, ev1, -1, 0, 0]), "23514");
    denied(await as(U.carol, ins, [ws1, ev1, 1, 1, 1]), "42501");
    denied(await as(U.bob, "update public.budget_items set quote_id=$1 where event_id=$2", [quote, ev1]), "42501");
  });
});

describe("venue layout", () => {
  test("items must be inside the venue", async () => {
    const item = "insert into public.layout_items (workspace_id,event_id,kind,label,x_cm,y_cm,w_cm,h_cm) values ($1,$2,'table','T1',$3,$4,$5,$6)";
    denied(await as(U.bob, item, [ws1, ev1, 0, 0, 100, 100]), "23514"); // event has no venue yet
    venue = (await as(U.bob, "insert into public.venues (workspace_id,name,width_cm,depth_cm) values ($1,'Pier 9',1000,800) returning id", [ws1])).rows[0].id;
    ok(await as(U.bob, "update public.events set venue_id=$1 where id=$2", [venue, ev1]));
    ok(await as(U.bob, item, [ws1, ev1, 900, 700, 100, 100])); // flush with the corner
    denied(await as(U.bob, item, [ws1, ev1, 901, 0, 100, 100]), "23514");
    denied(await as(U.bob, item, [ws1, ev1, 0, 0, 0, 100]), "23514");
    denied(await as(U.carol, item, [ws1, ev1, 0, 0, 10, 10]), "42501");
  });
  test("deleting a venue keeps the event", async () => {
    ok(await as(U.bob, "delete from public.venues where id=$1", [venue]));
    const r = await as(U.bob, "select venue_id from public.events where id=$1", [ev1]);
    assert.equal(r.rows[0].venue_id, null);
  });
  test("a venue from another workspace cannot be attached", async () => {
    const v2 = (await as(U.dave, "insert into public.venues (workspace_id,name,width_cm,depth_cm) values ($1,'Theirs',500,500) returning id", [ws2])).rows[0].id;
    denied(await as(U.bob, "update public.events set venue_id=$1 where id=$2", [v2, ev1]), "23503");
  });
});

describe("accept quote -> budget line (migration 005)", () => {
  let sup, ev3;
  const quoteSql = "insert into public.quotes (workspace_id,event_id,supplier_id,amount_minor,status) values ($1,$2,$3,$4,$5) returning id";
  const newQuote = async (amount, status = "shortlisted", event = ev1) => (await as(U.bob, quoteSql, [ws1, event, sup, amount, status])).rows[0].id;
  const committedTotal = async (event = ev1) =>
    Number((await as(U.bob, "select coalesce(sum(committed_minor),0)::bigint as n from public.budget_items where event_id=$1", [event])).rows[0].n);
  const itemsFor = async (q) => (await as(U.bob, "select * from public.budget_items where quote_id=$1", [q])).rows;
  const accept = async (q, into = null) => (await as(U.bob, "select public.accept_quote($1,$2) as item", [q, into]));

  test("setup: a supplier and a second event", async () => {
    sup = (await as(U.bob, "insert into public.suppliers (workspace_id,name,category) values ($1,'Sound Crew','Sound & lighting') returning id", [ws1])).rows[0].id;
    ev3 = (await as(U.bob, "insert into public.events (workspace_id,title,starts_at,ends_at) values ($1,'Other event','2026-12-01T10:00Z','2026-12-01T12:00Z') returning id", [ws1])).rows[0].id;
  });
  test("a quote cannot be created or set to 'accepted' directly", async () => {
    denied(await as(U.bob, quoteSql, [ws1, ev1, sup, 5000, "accepted"]), "42501");
    const q = await newQuote(5000);
    denied(await as(U.bob, "update public.quotes set status='accepted' where id=$1", [q]), "42501");
  });
  test("accepting creates ONE linked line with the quote amount and the supplier's name and category", async () => {
    const before = await committedTotal();
    const q = await newQuote(250050);
    const r = await accept(q);
    ok(r);
    const item = (await itemsFor(q))[0];
    assert.equal(item.id, r.rows[0].item);
    assert.equal(Number(item.committed_minor), 250050);
    assert.equal(Number(item.planned_minor), 250050);
    assert.equal(Number(item.paid_minor), 0);
    assert.equal(item.name, "Sound Crew");
    assert.equal(item.category, "Sound & lighting");
    assert.equal((await as(U.bob, "select status from public.quotes where id=$1", [q])).rows[0].status, "accepted");
    assert.equal(await committedTotal(), before + 250050);
  });
  test("repeating accept is idempotent: same line, no duplicate, total unchanged", async () => {
    const q = await newQuote(100000);
    const first = (await accept(q)).rows[0].item;
    const total = await committedTotal();
    for (let i = 0; i < 3; i++) assert.equal((await accept(q)).rows[0].item, first);
    assert.equal((await itemsFor(q)).length, 1);
    assert.equal(await committedTotal(), total);
    denied(await accept(q, ev3 /* any uuid that is not the linked line */), "23505");
  });
  test("collaborators and outsiders cannot accept or re-open", async () => {
    const q = await newQuote(7000);
    denied(await as(U.carol, "select public.accept_quote($1)", [q]), "42501");
    denied(await as(U.dave, "select public.accept_quote($1)", [q]), "42501");
    denied(await as(U.carol, "select public.reopen_quote($1)", [q]), "42501");
    denied(await as(null, "select public.accept_quote($1)", [q]), "42501");
  });
  test("a rejected quote cannot be accepted", async () => {
    denied(await accept(await newQuote(7000, "rejected")), "P0001");
  });
  test("linking to an existing line REPLACES its committed amount (no double counting)", async () => {
    const line = (await as(U.bob, "insert into public.budget_items (workspace_id,event_id,category,name,planned_minor,committed_minor,paid_minor) values ($1,$2,'Decor','Banners',100000,120000,0) returning id", [ws1, ev1])).rows[0].id;
    const before = await committedTotal();
    const q = await newQuote(90000);
    ok(await accept(q, line));
    const row = (await as(U.bob, "select planned_minor, committed_minor, quote_id from public.budget_items where id=$1", [line])).rows[0];
    assert.equal(Number(row.committed_minor), 90000);
    assert.equal(Number(row.planned_minor), 100000);
    assert.equal(row.quote_id, q);
    assert.equal(await committedTotal(), before - 120000 + 90000);
  });
  test("linking fails (and changes nothing) if already paid more than the quote, or the line is elsewhere", async () => {
    const line = (await as(U.bob, "insert into public.budget_items (workspace_id,event_id,category,name,planned_minor,committed_minor,paid_minor) values ($1,$2,'Decor','Paid up',100000,100000,80000) returning id", [ws1, ev1])).rows[0].id;
    const q = await newQuote(50000);
    denied(await accept(q, line), "23514");
    assert.equal((await as(U.bob, "select status from public.quotes where id=$1", [q])).rows[0].status, "shortlisted");
    const other = (await as(U.bob, "insert into public.budget_items (workspace_id,event_id,category,name) values ($1,$2,'Decor','Other event line') returning id", [ws1, ev3])).rows[0].id;
    denied(await accept(q, other), "P0002");
  });
  test("while accepted: committed amount, quote amount, supplier and status are locked; planned and paid are not", async () => {
    const q = await newQuote(60000);
    const line = (await accept(q)).rows[0].item;
    denied(await as(U.bob, "update public.budget_items set committed_minor=1 where id=$1", [line]), "P0001");
    denied(await as(U.bob, "update public.quotes set amount_minor=1 where id=$1", [q]), "P0001");
    denied(await as(U.bob, "update public.quotes set status='rejected' where id=$1", [q]), "P0001");
    ok(await as(U.bob, "update public.budget_items set planned_minor=70000, paid_minor=20000 where id=$1", [line]));
  });
  test("re-open unlinks but keeps the line; the quote can be accepted again into that same line", async () => {
    const q = await newQuote(40000);
    const line = (await accept(q)).rows[0].item;
    const total = await committedTotal();
    ok(await as(U.bob, "select public.reopen_quote($1)", [q]));
    const row = (await as(U.bob, "select quote_id, committed_minor from public.budget_items where id=$1", [line])).rows[0];
    assert.equal(row.quote_id, null);
    assert.equal(Number(row.committed_minor), 40000);
    assert.equal(await committedTotal(), total);
    assert.equal((await as(U.bob, "select status from public.quotes where id=$1", [q])).rows[0].status, "shortlisted");
    ok(await as(U.bob, "update public.budget_items set committed_minor=45000 where id=$1", [line])); // editable again
    ok(await accept(q, line)); // linking replaces 45000 with the quote's 40000
    assert.equal((await itemsFor(q)).length, 1);
    assert.equal(await committedTotal(), total);
  });
  test("deleting a linked line puts its quote back to 'shortlisted' so it can be accepted again", async () => {
    const q = await newQuote(33000);
    const line = (await accept(q)).rows[0].item;
    ok(await as(U.bob, "delete from public.budget_items where id=$1", [line]));
    assert.equal((await as(U.bob, "select status from public.quotes where id=$1", [q])).rows[0].status, "shortlisted");
    ok(await accept(q));
    assert.equal((await itemsFor(q)).length, 1);
  });
});

describe("venue fit, atomic layout save, sample event, account deletion (migration 006)", () => {
  let venue, small, event;
  const ONE = "2026-12-01T10:00Z", TWO = "2026-12-01T12:00Z";
  const items = async () => (await as(U.bob, "select id, label, x_cm, y_cm, w_cm, h_cm, updated_at::text as version from public.layout_items where event_id=$1 order by label", [event])).rows;
  const save = (user, ups, dels = []) => as(user, "select public.save_layout($1, $2::jsonb, $3::uuid[]) as n", [event, JSON.stringify(ups), dels]);

  test("setup: a venue, an event on it, and one item flush with the corner", async () => {
    venue = (await as(U.bob, "insert into public.venues (workspace_id,name,width_cm,depth_cm) values ($1,'Fit Hall',1000,800) returning id", [ws1])).rows[0].id;
    small = (await as(U.bob, "insert into public.venues (workspace_id,name,width_cm,depth_cm) values ($1,'Tiny Hall',500,500) returning id", [ws1])).rows[0].id;
    event = (await as(U.bob, "insert into public.events (workspace_id,title,starts_at,ends_at,venue_id) values ($1,'Layout event',$2,$3,$4) returning id", [ws1, ONE, TWO, venue])).rows[0].id;
    ok(await as(U.bob, "insert into public.layout_items (workspace_id,event_id,kind,label,x_cm,y_cm,w_cm,h_cm) values ($1,$2,'table','Corner',900,700,100,100)", [ws1, event]));
  });
  test("a venue cannot be shrunk below a layout item; same size or larger is fine", async () => {
    denied(await as(U.bob, "update public.venues set width_cm=950 where id=$1", [venue]), "23514");
    denied(await as(U.bob, "update public.venues set depth_cm=790 where id=$1", [venue]), "23514");
    ok(await as(U.bob, "update public.venues set width_cm=1200, depth_cm=900 where id=$1", [venue]));
    ok(await as(U.bob, "update public.venues set width_cm=1000, depth_cm=800 where id=$1", [venue]));
  });
  test("an event cannot be attached to a venue its layout does not fit; a larger one or none is fine", async () => {
    denied(await as(U.bob, "update public.events set venue_id=$1 where id=$2", [small, event]), "23514");
    ok(await as(U.bob, "update public.events set venue_id=null where id=$1", [event]));
    ok(await as(U.bob, "update public.events set venue_id=$1 where id=$2", [venue, event]));
  });
  test("deleting a venue keeps the event and its saved layout items", async () => {
    const v2 = (await as(U.bob, "insert into public.venues (workspace_id,name,width_cm,depth_cm) values ($1,'Temp Hall',1000,800) returning id", [ws1])).rows[0].id;
    ok(await as(U.bob, "update public.events set venue_id=$1 where id=$2", [v2, event]));
    ok(await as(U.bob, "delete from public.venues where id=$1", [v2]));
    assert.equal((await as(U.bob, "select venue_id from public.events where id=$1", [event])).rows[0].venue_id, null);
    assert.equal((await items()).length, 1);
    ok(await as(U.bob, "update public.events set venue_id=$1 where id=$2", [venue, event])); // reattach
  });
  test("save_layout applies inserts, updates and deletes together", async () => {
    const [corner] = await items();
    const r = await save(U.bob, [{ id: corner.id, version: corner.version, kind: "table", label: "Corner moved", x: 800, y: 600, w: 100, h: 100 }, { kind: "stage", label: "New stage", x: 0, y: 0, w: 300, h: 200 }]);
    ok(r);
    assert.equal(Number(r.rows[0].n), 2);
    const now = await items();
    assert.deepEqual(now.map((i) => i.label), ["Corner moved", "New stage"]);
    assert.equal(Number(now[0].x_cm), 800);
    const stage = now[1];
    ok(await save(U.bob, [], [stage.id]));
    assert.equal((await items()).length, 1);
  });
  test("a stale item version rejects the whole save and changes nothing", async () => {
    const [it] = await items();
    const r = await save(U.bob, [{ kind: "booth", label: "Should not appear", x: 0, y: 0, w: 100, h: 100 }, { id: it.id, version: "2000-01-01 00:00:00+00", kind: "table", label: "Stale", x: 0, y: 0, w: 100, h: 100 }]);
    denied(r, "P0001");
    assert.deepEqual((await items()).map((i) => i.label), ["Corner moved"]);
  });
  test("an out-of-bounds item rejects the whole save (atomic)", async () => {
    denied(await save(U.bob, [{ kind: "booth", label: "Fine", x: 0, y: 0, w: 100, h: 100 }, { kind: "booth", label: "Too far", x: 950, y: 0, w: 100, h: 100 }]), "23514");
    assert.deepEqual((await items()).map((i) => i.label), ["Corner moved"]);
  });
  test("collaborators and outsiders cannot save a layout", async () => {
    denied(await save(U.carol, [{ kind: "booth", label: "x", x: 0, y: 0, w: 10, h: 10 }]), "42501");
    denied(await save(U.dave, [{ kind: "booth", label: "x", x: 0, y: 0, w: 10, h: 10 }]), "P0002");
    denied(await save(null, []), "42501"); // anonymous has no EXECUTE at all
  });

  describe("sample event", () => {
    let demoEv, plainEv, demoSupplier;
    const count = async (table, ev) => Number((await as(U.bob, `select count(*)::int as n from public.${table} where event_id=$1`, [ev])).rows[0].n);
    test("only organisers and owners of the target workspace can load it", async () => {
      denied(await as(U.carol, "select public.reset_demo($1)", [ws1]), "42501");
      denied(await as(U.dave, "select public.reset_demo($1)", [ws1]), "42501");
      denied(await as(U.bob, "select public.reset_demo($1)", [ws2]), "42501");
      denied(await as(null, "select public.reset_demo($1)", [ws1]), "42501");
    });
    test("creates a complete, consistent fictional event", async () => {
      plainEv = event;
      const r = await as(U.bob, "select public.reset_demo($1) as ev", [ws1]);
      ok(r);
      demoEv = r.rows[0].ev;
      const counts = Object.fromEntries(await Promise.all(["tasks", "guests", "schedule_entries", "layout_items", "quotes", "budget_items", "notes"].map(async (t) => [t, await count(t, demoEv)])));
      assert.deepEqual(counts, { tasks: 8, guests: 12, schedule_entries: 8, layout_items: 11, quotes: 5, budget_items: 5, notes: 1 });
      const e = (await as(U.bob, "select title, demo, capacity, currency, timezone, venue_id from public.events where id=$1", [demoEv])).rows[0];
      assert.equal(e.demo, true);
      assert.equal(e.capacity, 150);
      assert.ok(e.venue_id);
      const accepted = (await as(U.bob, "select count(*)::int as n from public.quotes q join public.budget_items b on b.quote_id=q.id where q.event_id=$1 and q.status='accepted'", [demoEv])).rows[0].n;
      assert.equal(accepted, 2);
      const over = (await as(U.bob, "select count(*)::int as n from public.budget_items where event_id=$1 and paid_minor>committed_minor", [demoEv])).rows[0].n;
      assert.equal(over, 0);
      demoSupplier = (await as(U.bob, "select id from public.suppliers where workspace_id=$1 and demo limit 1", [ws1])).rows[0].id;
    });
    test("clients cannot set the demo flag themselves", async () => {
      denied(await as(U.bob, "insert into public.events (workspace_id,title,starts_at,ends_at,demo) values ($1,'x',$2,$3,true)", [ws1, ONE, TWO]), "42501");
      denied(await as(U.bob, "update public.events set demo=true where id=$1", [plainEv]), "42501");
    });
    test("reset replaces ONLY the sample event; the user's own event, suppliers and the other workspace are untouched", async () => {
      const before2 = Number((await as(U.dave, "select count(*)::int as n from public.events")).rows[0].n);
      const ownQuote = (await as(U.bob, "insert into public.quotes (workspace_id,event_id,supplier_id,amount_minor) values ($1,$2,$3,1000) returning id", [ws1, plainEv, demoSupplier])).rows[0].id;
      const r = await as(U.bob, "select public.reset_demo($1) as ev", [ws1]);
      ok(r);
      assert.notEqual(r.rows[0].ev, demoEv);
      const demos = (await as(U.bob, "select count(*)::int as n from public.events where workspace_id=$1 and demo", [ws1])).rows[0].n;
      assert.equal(demos, 1);
      assert.equal((await as(U.bob, "select count(*)::int as n from public.events where id=$1", [plainEv])).rows[0].n, 1);
      assert.equal((await as(U.bob, "select count(*)::int as n from public.quotes where id=$1", [ownQuote])).rows[0].n, 1); // supplier in use is kept
      assert.equal(Number((await as(U.dave, "select count(*)::int as n from public.events")).rows[0].n), before2);
      assert.equal(await count("tasks", r.rows[0].ev), 8); // fresh, not doubled
    });
  });

  describe("account deletion policy", () => {
    let erin, frank, ws3;
    test("setup: two users and a workspace they share", async () => {
      erin = (await db.query("insert into auth.users (email) values ('erin@example.test') returning id")).rows[0].id;
      frank = (await db.query("insert into auth.users (email) values ('frank@example.test') returning id")).rows[0].id;
      ws3 = (await as(erin, "select public.create_workspace('Shared Co') as id")).rows[0].id;
      ok(await as(erin, "select public.add_workspace_member($1,'frank@example.test','collaborator')", [ws3]));
      ok(await as(erin, "insert into public.events (workspace_id,title,starts_at,ends_at) values ($1,'Erin event',$2,$3)", [ws3, ONE, TWO]));
      ok(await as(erin, "insert into public.notes (workspace_id,event_id,body) select $1, id, 'my note' from public.events where workspace_id=$1", [ws3]));
    });
    test("a sole owner with other members is blocked, and nothing is removed", async () => {
      const b = await as(erin, "select * from public.account_deletion_blockers()");
      assert.equal(b.rows.length, 1);
      assert.equal(b.rows[0].name, "Shared Co");
      assert.equal(Number(b.rows[0].other_members), 1);
      assert.equal((await as(erin, "select public.remove_my_sole_workspaces() as n")).rows[0].n, 0);
      await assert.rejects(db.query("delete from auth.users where id=$1", [erin]), /at least one owner/);
      assert.equal((await as(frank, "select count(*)::int as n from public.workspaces where id=$1", [ws3])).rows[0].n, 1);
    });
    test("members who are not the sole owner are not blocked", async () => {
      assert.equal((await as(frank, "select * from public.account_deletion_blockers()")).rows.length, 0);
    });
    test("after transferring ownership the account can be deleted; shared records stay; authorship is cleared", async () => {
      ok(await as(erin, "select public.set_member_role($1,$2,'owner')", [ws3, frank]));
      assert.equal((await as(erin, "select * from public.account_deletion_blockers()")).rows.length, 0);
      ok(await db.query("delete from auth.users where id=$1", [erin]));
      assert.equal((await as(frank, "select count(*)::int as n from public.events where workspace_id=$1", [ws3])).rows[0].n, 1);
      const note = (await as(frank, "select author_id from public.notes where workspace_id=$1", [ws3])).rows[0];
      assert.equal(note.author_id, null);
      assert.equal((await as(frank, "select count(*)::int as n from public.profiles where id=$1", [erin])).rows[0].n, 0);
    });
    test("a user who is the only member has their workspace removed with the account", async () => {
      assert.equal((await as(frank, "select public.remove_my_sole_workspaces() as n")).rows[0].n, 1);
      assert.equal((await db.query("select count(*)::int as n from public.workspaces where id=$1", [ws3])).rows[0].n, 0);
      ok(await db.query("delete from auth.users where id=$1", [frank]));
    });
  });
});

describe("deletion", () => {
  test("a member can leave; their assigned tasks become unassigned", async () => {
    ok(await as(U.carol, "select public.remove_member($1,$2)", [ws1, U.carol]));
    const r = await as(U.alice, "select count(*)::int as n from public.tasks where assignee_id=$2 and workspace_id=$1", [ws1, U.carol]);
    assert.equal(r.rows[0].n, 0);
    none(await as(U.carol, "select * from public.events where workspace_id=$1", [ws1]));
  });
  test("only an owner can delete a workspace; cascade is not blocked by the last-owner rule", async () => {
    denied(await as(U.bob, "select public.delete_workspace($1)", [ws1]), "42501");
    denied(await as(U.carol, "select public.delete_workspace($1)", [ws1]), "42501");
    ok(await as(U.alice, "select public.delete_workspace($1)", [ws1]));
    none(await as(U.bob, "select id from public.workspaces where id=$1", [ws1]));
    const left = (await db.query("select count(*)::int as n from public.events where workspace_id=$1", [ws1])).rows[0].n;
    assert.equal(left, 0);
  });
  test("a user who is the sole owner cannot be deleted", async () => {
    await assert.rejects(db.query("delete from auth.users where id=$1", [U.dave]), /at least one owner/);
  });
  test("a profile is created for each user and others cannot edit it", async () => {
    const p = await as(U.dave, "select display_name from public.profiles where id=$1", [U.dave]);
    assert.equal(p.rows[0].display_name, "dave");
    none(await as(U.dave, "update public.profiles set display_name='x' where id=$1 returning id", [U.alice]));
  });
});
