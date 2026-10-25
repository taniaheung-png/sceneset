// Checks Supabase configuration WITHOUT printing any secret value.
// Usage: npm run check:env      (reads .env.local via node --env-file)
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const pub = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sec = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

const kind = (v) =>
  !v ? "MISSING" : v.startsWith("sb_publishable_") ? "publishable" : v.startsWith("sb_secret_") ? "secret" : v.startsWith("eyJ") ? "legacy JWT" : "unrecognised";
const line = (ok, text) => console.log(`${ok === true ? "ok  " : ok === false ? "FAIL" : "info"} ${text}`);

let bad = 0;
const check = (ok, text) => (line(ok, text), ok || bad++);

check(/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url ?? ""), "NEXT_PUBLIC_SUPABASE_URL looks like https://<ref>.supabase.co");
check(env.NEXT_PUBLIC_SITE_URL === "http://localhost:3000" || /^https?:\/\//.test(env.NEXT_PUBLIC_SITE_URL ?? ""), `NEXT_PUBLIC_SITE_URL is set (${env.NEXT_PUBLIC_SITE_URL ?? "MISSING"})`);
check(["publishable", "legacy JWT"].includes(kind(pub)), `public key present (type: ${kind(pub)})`);
check(kind(pub) !== "secret", "public variable does not hold a secret key");
line(null, `server secret key present: ${sec ? kind(sec) : "no (only needed by the RLS test script and, later, account deletion)"}`);
if (pub?.startsWith("eyJ")) {
  const role = JSON.parse(Buffer.from(pub.split(".")[1], "base64url").toString()).role;
  check(role === "anon", `legacy JWT in the public variable has role "${role}" (must be anon)`);
}
if (bad) process.exit(1);

const headers = { apikey: pub };
const get = async (path) => {
  try {
    const r = await fetch(url + path, { headers });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { status: 0, body: { message: e.message } };
  }
};

const s = await get("/auth/v1/settings");
if (s.status !== 200) {
  check(false, `could not read auth settings (HTTP ${s.status}). Check the URL and key.`);
  process.exit(1);
}
check(s.body.mailer_autoconfirm === false, "email confirmation is ON (mailer_autoconfirm is false)");
check(s.body.external?.anonymous_users !== true, "anonymous sign-ins are OFF");
check(s.body.external?.email === true, "email sign-in provider is enabled");
line(null, `public sign-ups allowed: ${s.body.disable_signup === false}`);

const t = await get("/rest/v1/workspaces?select=id&limit=1");
// With migrations applied the anon role has no table privilege (42501). Before: table missing (PGRST205).
const applied = t.body.code === "42501" || t.status === 200;
check(applied, applied ? "migrations applied (workspaces table exists and anon is denied)" : `migrations NOT applied yet (${t.body.code ?? t.status})`);
// Migration 005 adds accept_quote(). With it present, anon is denied (42501); without it PostgREST says it cannot find it (PGRST202).
const rpc = await fetch(`${url}/rest/v1/rpc/accept_quote`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ quote: "00000000-0000-0000-0000-000000000000" }) });
const rpcBody = await rpc.json().catch(() => ({}));
const has005 = rpcBody.code === "42501";
check(has005, has005 ? "migration 005 applied (accept_quote exists)" : `migration 005 NOT applied yet (${rpcBody.code ?? rpc.status}). Run: npm run db:bundle -- 5, then paste supabase/_bundle.sql in the SQL Editor`);
// Migration 006 adds save_layout(). With it present, anon is denied (42501); without it PostgREST says it cannot find it (PGRST202).
const rpc6 = await fetch(`${url}/rest/v1/rpc/save_layout`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ ev: "00000000-0000-0000-0000-000000000000", upserts: [], deletes: [] }) });
const rpc6Body = await rpc6.json().catch(() => ({}));
const has006 = rpc6Body.code === "42501";
check(has006, has006 ? "migration 006 applied (save_layout exists)" : `migration 006 NOT applied yet (${rpc6Body.code ?? rpc6.status}). Run: npm run db:bundle -- 6, then paste supabase/_bundle.sql in the SQL Editor`);
// Migrations 007 and 008: the sandbox functions. 008 makes them server-only (signature with `actor`): anon gets 42501 when it exists
// and PGRST202 when it does not. The 007 signature (no actor) answers 42501 to anon while it is still there.
const probeRpc = async (name, args) => {
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(args) });
  return (await r.json().catch(() => ({}))).code;
};
const z = "00000000-0000-0000-0000-000000000000";
const has008 = (await probeRpc("sandbox_checkout", { actor: z, ws: z, plan_id: "organiser", ev: null, outcome: "success", idem: "0123456789abcdef" })) === "42501";
const has007 = has008 || (await probeRpc("sandbox_checkout", { ws: z, plan_id: "organiser", ev: null, outcome: "success", idem: "0123456789abcdef" })) === "42501";
check(has007, has007 ? "migration 007 applied (plan limits and sandbox functions exist)" : "migration 007 NOT applied yet. Run: npm run db:bundle -- 7, then paste supabase/_bundle.sql in the SQL Editor");
check(has008, has008 ? "migration 008 applied (sandbox functions are server-only)" : "migration 008 NOT applied yet: signed-in users could still call the sandbox functions directly. Run: npm run db:bundle -- 8, then paste supabase/_bundle.sql in the SQL Editor");
process.exit(bad ? 1 : 0);
