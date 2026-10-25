# SceneSet

Event planning workspace (prototype, coursework). **Status: implementation phase 7 of 8** — public pages, design system, a read-only demo, and (once Supabase is set up) accounts, workspaces and member roles. Events, the event dashboard, tasks, notes, suppliers, quotes and the budget are built (migration 005 adds the accept-quote function; apply it with `npm run db:bundle -- 5`); guests and the running order work; the venue layout, readiness check and print summary arrive in phase 6. See `PRD.md` (spec), `tasklist.md` (progress) and `docs/QA.md` (evidence).

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Checks: `npm run lint` · `npm run typecheck` · `npm run build` · `npm run contrast` · `npm test`
(`npm test` runs unit tests and the SQL/RLS tests on an in-process Postgres; it needs no Supabase project.)

## Supabase setup (development project only)

Use a **development** project. Do not point this app at a project with real data.

1. **Create the project** at supabase.com → New project. Keep the database password somewhere safe (this app does not need it).
2. **Copy the values** into `.env.local` (copy `.env.example` first; the file is git-ignored):

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → Project URL (`https://<ref>.supabase.co`) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key (`sb_publishable_…`). A legacy `anon` key also works. |
   | `SUPABASE_SECRET_KEY` | Project Settings → API Keys → Secret key (`sb_secret_…`). Server/scripts only; used by `npm run test:remote`. Never put it in a `NEXT_PUBLIC_` variable. |
   | `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for local work |

   The older names `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are still read as fallbacks.
3. **Auth redirect URLs** — Authentication → URL Configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/**`
   - When you deploy, add your real site URL and `https://<your-domain>/**` here too.
4. **Sign-in settings** — Authentication → Sign In / Providers:
   - Email provider **enabled**, **Confirm email ON** (leave it on; the tests do not need it off).
   - **Anonymous sign-ins OFF.**
   - Minimum password length: 8.
5. **Email templates (recommended)** — Authentication → Emails → Templates. Replace the link in each so it works from any browser, via `/auth/confirm`:
   - *Confirm sign up*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app`
   - *Reset password*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

   If you keep the default templates the links still work, but only in the same browser that requested them.
6. **Create the database** — run `npm run db:bundle` (later migrations only: `npm run db:bundle -- 5` writes migration 5 and above), open Dashboard → SQL Editor → New query, paste the contents of `supabase/_bundle.sql`, and Run. Run it **once** on an empty project: the migrations are not idempotent. To start over, create a fresh development project (simplest) rather than editing the schema by hand.
7. **Verify** — `npm run check:env` prints only pass/fail (never values): URL shape, key types, email confirmation on, anonymous sign-ins off, migrations applied. Then run the access tests against the real project:

   ```powershell
   $env:RLS_TEST_CONFIRM = "dev-project"; npm run test:remote
   ```

   It creates and deletes throw-away users (via the secret key; project email confirmation stays on) and tries forbidden operations through the public API.

### Test accounts without email (for role testing)

Testing roles needs several accounts, which the built-in email limit makes impractical. This creates pre-confirmed throw-away users (`dev-owner@example.test`, `dev-organiser@…`, `dev-collaborator@…`, `dev-outsider@…`) through the admin API; project-wide email confirmation stays on:

```powershell
$env:RLS_TEST_CONFIRM = "dev-project"; npm run dev:users -- create   # prints one shared password
$env:RLS_TEST_CONFIRM = "dev-project"; npm run dev:users -- delete   # removes them and their workspaces
```

Only those four fixed addresses are ever touched. Use a real address for the sign-up and password-reset email checks.

Browser checks for roles, onboarding and member management run in headless Chromium (project-local Playwright; install once with `npx playwright install chromium`): with the dev server running and the test users created, `$env:DEV_USERS_PASSWORD = "<printed password>"; npm run test:e2e` (phase 2) `npm run test:e2e:p3` (phase 3) `npm run test:e2e:p4` (phase 4, needs migration 005) `npm run test:e2e:p5` (phase 5) and `npm run test:e2e:p6` (phase 6; needs migration 006, or set `E2E_NO006=1` to skip the steps that need it) and `npm run test:e2e:p7` (phase 7; needs migrations 007 and 008 and `PAYMENT_SANDBOX_ENABLED=true` on the dev server, or set `E2E_NO008=1` to skip the steps that need them). Then stop that server, start a fresh one with `PAYMENT_SANDBOX_ENABLED=false` (`$env:PAYMENT_SANDBOX_ENABLED = "false"; npm run dev`) and run `npm run test:e2e:p7:off`, which replays the real checkout requests against the switched-off server. The phase 3 to 5 suites mark their disposable workspace as Organiser first, because the free plan allows one active event. Run each suite on freshly created test users (`npm run dev:users -- delete`, then `create`) and run them one at a time: they share the same four accounts. Delete the users afterwards.

### Built-in email limits (important for testing)

Supabase's built-in email service is for development only. Per Supabase's documentation it **delivers only to addresses that belong to your project's team** (others fail with "Email address not authorized"), is capped at about **2 messages per hour** for the whole project (value can change; see Authentication → Rate Limits), and has no delivery guarantee. So: add the address you test with as a team member (Organization settings → Team), expect to wait between sign-up and reset tests, and configure custom SMTP before inviting real users. Do not disable email confirmation to work around this.

## Test-mode plans (phase 7)

Pricing is a **simulation**: no payment provider, no card fields, no real money, no recurring billing. Prices (HKD 149 per event, HKD 299 per month) are unvalidated hypotheses. Free Personal allows 1 active event and 3 members; an Event Upgrade lets the workspace have up to 10 members and removes the SceneSet footer from that event's printed summary; Organiser has no limits. Nothing else is locked, so every feature can be demonstrated on Free.

- Apply migrations 007 and 008 once to the development project: `npm run db:bundle -- 7`, paste `supabase/_bundle.sql` into Dashboard → SQL Editor → New query, and Run (it runs both; never run one twice). Then `npm run check:env` should say "migration 007 applied" and "migration 008 applied". Migration 008 makes the plan functions executable only by the server's secret key, so `SUPABASE_SECRET_KEY` must be set wherever test checkouts are used.
- **Intended setting.** `PAYMENT_SANDBOX_ENABLED` ships as `false`. Set it to `true` (with `SUPABASE_SECRET_KEY`) on development machines and on the deployment used to demonstrate this coursework prototype, because the sandbox only simulates and never takes money. Keep it `false` on any deployment that real people could mistake for a paid service. With it off, plan pages say the test checkout is switched off, every checkout and end-plan request is refused (including a replayed raw request), and nothing in the database changes; the free-plan limits still apply. After changing it, restart the server.
- Workspace owners open **Plan** in the side menu, choose a plan, and finish with Simulate success, cancellation or failure. Only success changes the plan; each attempt is logged.
- The free-plan limits are enforced by the database as well as the app. A workspace's own events and members are never deleted when it returns to Free.

## Not built yet

The full deployment guide and demo instructions are written at the final phase (task P8.10).

