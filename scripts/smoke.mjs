// Read-only smoke test for a RUNNING site (a local production build, or your deployed site). It only sends GET requests,
// signs in to nothing and writes nothing.
//
//   npm run smoke -- http://localhost:3100
//   npm run smoke -- https://your-deployed-site.example
//
// It checks: public pages load; development-only routes are gone; private routes send visitors to sign-in; basic security
// headers; the prototype, provisional-price and test-payment disclosures are on the pages; an off-site ?next= is not followed;
// and no secret-looking text appears in any page it fetched. It cannot check email delivery, sign-in or the database.
const base = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: npm run smoke -- <base URL>, for example http://localhost:3100");
  process.exit(2);
}
let failed = 0;
const pages = new Map();
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` (${detail})`}`);
};
const get = async (path, opts = {}) => {
  const res = await fetch(base + path, { redirect: "manual", ...opts });
  const body = res.status < 300 || res.status >= 400 ? await res.text() : "";
  pages.set(path, body);
  return { res, body };
};

const PUBLIC = ["/", "/pricing", "/privacy", "/login", "/signup", "/forgot-password", "/demo", "/demo/tasks", "/demo/budget", "/demo/suppliers", "/demo/guests", "/demo/schedule", "/demo/layout", "/demo/summary"];
for (const p of PUBLIC) {
  const { res } = await get(p);
  check(`public page ${p} loads`, res.status === 200, `status ${res.status}`);
}
for (const p of ["/dev/kit", "/demo/nonsense", "/no-such-page", "/w/not-a-uuid/events"]) {
  const { res } = await get(p);
  check(`${p} is not available to a visitor (404 or sign-in redirect)`, res.status === 404 || (res.status >= 300 && res.status < 400 && /\/login/.test(res.headers.get("location") ?? "")), `status ${res.status}`);
}
const dev = await get("/dev/kit");
check("the development component kit is not served (404)", dev.res.status === 404, `status ${dev.res.status}`);
for (const p of ["/app", "/onboarding", "/w/00000000-0000-4000-8000-000000000000/events", "/w/00000000-0000-4000-8000-000000000000/settings", "/w/00000000-0000-4000-8000-000000000000/upgrade"]) {
  const { res } = await get(p);
  const to = res.headers.get("location") ?? "";
  check(`${p} sends a signed-out visitor to sign-in`, res.status >= 300 && res.status < 400 && /\/login/.test(to), `status ${res.status} to ${to}`);
}
const home = await get("/");
for (const h of ["x-content-type-options", "x-frame-options", "referrer-policy"]) check(`security header ${h} is set`, Boolean(home.res.headers.get(h)), "missing");
check("the landing page states the prototype and no-real-payment disclosure", /prototype/i.test(home.body) && /no real payment/i.test(home.body), "disclosure text missing");
const pricing = await get("/pricing");
check("pricing shows HKD 149 per event and HKD 299 per month as provisional, with the test-payment note", /HKD 149/.test(pricing.body) && /HKD 299/.test(pricing.body) && /Provisional prices/.test(pricing.body) && /No real payment is taken/.test(pricing.body), "text missing");
check("pricing marks the supplier suggestions as illustrative", /not a live marketplace/i.test(pricing.body), "label missing");
const privacy = await get("/privacy");
check("the privacy page covers collection, retention and deletion", /collect/i.test(privacy.body) && /retention|keep/i.test(privacy.body) && /delet/i.test(privacy.body), "text missing");
const demo = await get("/demo");
check("the demo says it is read-only and fictional", /read-only/i.test(demo.body) && /fictional/i.test(demo.body), "text missing");
const evil = await get("/auth/confirm?next=https://evil.example/&token_hash=x&type=email");
const loc = evil.res.headers.get("location") ?? "";
check("an off-site ?next= on the email-link route is never followed", !/evil\.example/.test(loc), `location ${loc}`);
const login = await get("/login?next=//evil.example");
check("the sign-in page renders with an off-site next (it is ignored after sign-in)", login.res.status === 200, `status ${login.res.status}`);
const leaked = [...pages].filter(([, body]) => /sb_secret_|service_role|SUPABASE_SECRET|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\./.test(body)).map(([p]) => p);
check("no secret-looking text in any fetched page", leaked.length === 0, leaked.join(", "));
console.log(`\n${failed ? `${failed} check(s) failed` : "All smoke checks passed"} against ${base}. This does not test sign-in, email, the database or the payment sandbox.`);
process.exit(failed ? 1 : 0);
