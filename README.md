# SceneSet

SceneSet is a desktop-first event-planning workspace (coursework prototype). One shared plan holds an event's tasks, notes, suppliers and quotes, budget, guests, running order and venue layout, with a readiness checklist and a printable summary. Next.js (App Router) + TypeScript + Tailwind, with Supabase (Postgres, Auth, row-level security).

**Status: all eight implementation phases are built and verified locally against a development Supabase project, and the site is deployed (section 11 has the links).** Everything below that says "verified" refers to local runs and the development project; the checks on the deployed site are listed separately in section 8 and `docs/QA.md`, and each is marked run or **not run**.

**Honest labels, kept in the product:** demo data is fictional; the HKD 149 per event and HKD 299 per month prices are unvalidated hypotheses; payments are a simulation and no real payment is ever taken; the supplier suggestions on the pricing page are an illustrative concept, not a marketplace.

Documents: [PRD.md](PRD.md) (what and why), [tasklist.md](tasklist.md) (ordered tasks and gates), [docs/QA.md](docs/QA.md) (evidence, requirement-to-evidence table, limits, blank testing grid).

---

## 1. Run it locally

Requirements: Node.js 22, npm, a Supabase **development** project (free tier is enough), Chromium for the browser tests (`npx playwright install chromium`).

```bash
npm install
cp .env.example .env.local     # then fill it in (section 2)
npm run dev                    # http://localhost:3000
```

Without Supabase the public pages and the read-only demo still work; sign-in and workspaces need the project below.

## 2. Environment variables

| Variable | Public? | Where to find it / purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes | The site's own URL, no trailing slash. `http://localhost:3000` locally; your real URL when deployed. It is built into the app at build time, so set it **before** building. Used for the links in confirmation and reset emails. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → Data API → Project URL (`https://<ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase → Project Settings → API Keys → Publishable key (`sb_publishable_…`). A legacy `anon` key also works. Safe in the browser only because row-level security protects the data. |
| `SUPABASE_SECRET_KEY` | **no, server only** | Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`). Used by two server actions (account deletion, and the test-mode plan functions) and by the test scripts. Never prefix with `NEXT_PUBLIC_`, never commit, never paste into chat. |
| `PAYMENT_SANDBOX_ENABLED` | no | `false` by default. See "Sandbox setting" below. |

The older names `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are still read as fallbacks. `npm run check:env` reports pass/fail for the setup and never prints a value.

### Sandbox setting (`PAYMENT_SANDBOX_ENABLED`)
- **Default and safe value: `false`.** Plan pages then say the test checkout is switched off; every checkout and end-plan request is refused, including a replayed raw request, and nothing in the database changes. The free-plan limits still apply.
- **Set `true` (with `SUPABASE_SECRET_KEY`) on a development machine and on the deployment you use to demonstrate this coursework prototype**, so the labelled payment *simulation* can be shown. It cannot charge anyone: there is no payment provider, no card field and no recurring billing.
- Keep it `false` on any deployment that real people could mistake for a paid service. Restart or redeploy after changing it.

## 3. Supabase setup (development project only)

Use a **development** project. Do not point this app or its test scripts at a project with real data.

1. Create the project (supabase.com → New project) and copy the values from section 2 into `.env.local`.
2. **Auth redirect URLs** (Authentication → URL Configuration): Site URL `http://localhost:3000`; Redirect URLs add `http://localhost:3000/**`. For a deployment add your real URL and `https://<your-domain>/**` (see section 8).
3. **Sign-in settings** (Authentication → Sign In / Providers): Email provider enabled, **Confirm email ON** (leave it on), **Anonymous sign-ins OFF**, minimum password length 8.
4. **Email templates (recommended)** (Authentication → Emails → Templates), so links work from any browser through `/auth/confirm`:
   - *Confirm sign up*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app`
   - *Reset password*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
5. **Create the database.** Apply migrations `supabase/migrations/…0001` to `…0008` in order. `npm run db:bundle` writes them to `supabase/_bundle.sql` (git-ignored); paste that file into Dashboard → SQL Editor → New query and Run **once** on an empty project. The migrations are not idempotent: never run one twice. To add later migrations to an existing project use `npm run db:bundle -- 7` (writes migration 7 and above). To start over, create a fresh project.

   | Migration | Adds |
   |---|---|
   | 001 | profiles, workspaces, members, roles, last-owner protection, workspace functions |
   | 002 | events, venues, tasks, notes, guests, schedule entries, layout items and their security rules |
   | 003 | suppliers, quotes, budget items |
   | 004 | the (test-mode) entitlement log |
   | 005 | accept-quote-into-budget function |
   | 006 | venue-fit and atomic layout save, sample event load/reset, account deletion helpers |
   | 007 | plan limits and the test checkout |
   | 008 | makes the test-plan functions server-only; member-limit fix |
6. **Verify.** `npm run check:env` should print "ok" for every line (URL shape, key types, email confirmation on, anonymous sign-ins off, migrations 001 to 008 applied).

   Note: the hosted development project was built up incrementally (bundles of 1 to 4, then 5, 6, 7 and 8 applied in turn). Applying all eight to a **brand-new** project in one go has been checked only on the local in-memory Postgres used by `npm test`, not on a second hosted project. Do that dry run on a throw-away project before relying on it.

### 3a. Dry run on a brand-new project (task P8.10; not yet run for you)

Use this to prove the setup instructions work from nothing, **without touching your existing development project**. The file `.env.fresh` is git-ignored (`.env*`); `.env.local` is never read or changed by these steps.

1. In Supabase create a **new** project (a free one is enough). Copy `.env.example` to `.env.fresh` and fill the same variables with the new project's values (URL, publishable key, secret key). Keep `PAYMENT_SANDBOX_ENABLED=true` there for step 5.
2. Authentication → Sign In / Providers: email on, **Confirm email ON**, anonymous sign-ins **OFF**, minimum password length 8 (section 3, step 3).
3. `npm run db:bundle`, then paste `supabase/_bundle.sql` into the new project's SQL Editor and Run **once**. (The same file was applied to an empty in-memory Postgres in one go and produced 14 tables, all with row-level security, and server-only plan functions. If the hosted editor reports an error, do not patch by hand: create another new project and start again.)
4. Check it:

   ```powershell
   node --env-file=.env.fresh scripts/check-env.mjs     # every line "ok", including migrations 005 to 008
   $env:RLS_TEST_CONFIRM = "dev-project"; node --env-file=.env.fresh scripts/rls-remote-test.mjs   # all checks pass (293 at the last run)
   ```

   The second command creates and deletes its own throw-away users and workspaces. Run it **before** you put anything you care about in the new project.
5. Smallest browser check (the whole journey, about 4 minutes). In one PowerShell window load the fresh values into the session so they override `.env.local`, and start the app:

   ```powershell
   Get-Content .env.fresh | ForEach-Object { if ($_ -match '^\s*([A-Z_]+)=(.*)$') { Set-Item "Env:$($Matches[1])" $Matches[2] } }
   npm run dev
   ```

   In a second window, load the same values, then:

   ```powershell
   Get-Content .env.fresh | ForEach-Object { if ($_ -match '^\s*([A-Z_]+)=(.*)$') { Set-Item "Env:$($Matches[1])" $Matches[2] } }
   $env:RLS_TEST_CONFIRM = "dev-project"
   node --env-file=.env.fresh scripts/dev-users.mjs create          # prints a password
   $env:DEV_USERS_PASSWORD = "<printed password>"
   node --env-file=.env.fresh e2e/phase8.mjs                         # expect all steps pass
   node --env-file=.env.fresh scripts/dev-users.mjs delete
   ```

   Close both windows afterwards so the session variables are gone. Record the results in `docs/QA.md` yourself, with the date; tick P8.10 in `tasklist.md` only if they pass.

## 4. Demo and test accounts

- **Public demo (no sign-in):** `/demo` is a read-only, fictional "Harbour Night Market" plan, built by the same rules as the real app.
- **Editable sample:** sign in, open Events, and use **Load a sample event** (owners and organisers). It fills that workspace with the same fictional data; **Reset sample event** replaces only the sample.
- **Disposable accounts for role testing (no email needed).** The built-in Supabase email is limited to a couple of messages an hour, so for role tests create four pre-confirmed fictional accounts (`dev-owner@example.test`, `dev-organiser@…`, `dev-collaborator@…`, `dev-outsider@…`):

  ```powershell
  $env:RLS_TEST_CONFIRM = "dev-project"; npm run dev:users -- create   # prints one shared password
  $env:RLS_TEST_CONFIRM = "dev-project"; npm run dev:users -- delete   # removes them and their workspaces
  ```

  Project-wide email confirmation stays on. **These accounts prove product behaviour, not email delivery.**

## 5. Tests (run one suite at a time; they share the four accounts)

| Command | What it checks | Needs |
|---|---|---|
| `npm run lint` · `npm run typecheck` · `npm run build` | static checks and the production build | — |
| `npm test` | unit, static and SQL/RLS tests on an in-memory Postgres, applying all eight migrations from empty | nothing |
| `npm run contrast` | colour-contrast pairs | — |
| `npm run check:env` | environment and migration state | `.env.local` |
| `npm run test:remote` | access and limit tests through the real API (creates and deletes throw-away users) | `RLS_TEST_CONFIRM=dev-project` |
| `npm run test:e2e` (phase 2), `:p3`, `:p4`, `:p5`, `:p6`, `:p7` | browser suites for each phase | dev server, fresh accounts, `DEV_USERS_PASSWORD` |
| `npm run test:e2e:p8` | the whole organiser journey on a Free workspace plus the final audits (responsive, accessibility basics, offline, print) | dev server with `PAYMENT_SANDBOX_ENABLED=true` |
| `npm run test:e2e:design` | the redesigned frame: phone drawer, keyboard order and focus rings, reduced motion, printed summary, empty and permission-restricted states, planner at phone and desktop width | dev server, fresh accounts |
| `node --env-file=.env.local e2e/design-shots.mjs after` | regenerates the review screenshots (`docs/design/after/`) from the real pages with fictional data | dev server, fresh accounts |
| `npm run test:e2e:p7:off` | with the sandbox switched **off**: UI and replayed raw requests are refused, database calls are refused | a fresh server started with the flag `false`, after `test:e2e:p7` |
| `npm run smoke -- <url>` | read-only checks of a running site: public pages, no dev routes, sign-in redirects, headers, disclosures, no secrets | a running site (local `next start` or your deployment) |

Run the browser suites with `$env:DEV_USERS_PASSWORD = "<printed password>"`. Recreate the accounts (`dev:users -- delete`, then `create`) between suites. The browser suites need the dev server on port 3000. Screenshots and PDFs go to a temp folder printed at the end of the run.

## 6. Organiser testing checklist (manual, about 30 minutes)

Use a real browser, fictional data only, and an account you created. Tick each line only if you saw it.

1. [ ] Sign up and sign in; sign out; try a private page while signed out (you land on sign-in and return afterwards).
2. [ ] Create a workspace, then an event that ends after midnight, with a venue, capacity and budget target.
3. [ ] Add a second person as organiser and a third as collaborator (they need accounts). As the collaborator, confirm you cannot create events, edit the budget or add tasks, and can only move your own task. As the organiser, confirm you cannot add members.
4. [ ] Add tasks, assign one, move them between columns, add a note; use the search and filters and their reset.
5. [ ] Add two suppliers and quotes; compare them (lowest marked); shortlist one, accept one. Open the budget: one new line, counted once.
6. [ ] Add a manual budget line with a paid amount; check planned, committed, paid, outstanding and remaining.
7. [ ] Add guests with party sizes and RSVPs; compare the confirmed headcount with capacity.
8. [ ] Build a running order that crosses midnight; check the "(+1 day)" marker and the warnings.
9. [ ] Place a table and a stage in the venue layout (try the arrow keys and the number boxes); save; reload.
10. [ ] Open the dashboard readiness list; fix an open item through its link; print the event summary (browser print preview): no menus or buttons, nothing cut off.
11. [ ] On a Free workspace try a second active event and a fourth member (both are refused with a plain message). As owner, open **Plan**, run the simulated Event Upgrade and Organiser (success, cancel, failure) and confirm only success changes anything.
12. [ ] Refresh, sign out and in: everything is still there. Open the demo and the sample event. Open a plan or event link from another account: you only see "Page not found".

Real-inbox checks (sign-up confirmation email, forgot-password email, reset completion) are **deferred** and not ticked: tasks P2.13, P2.15 and P2.16 in `tasklist.md`. They need a real mailbox that the Supabase built-in sender is allowed to reach.

## 7. What is verified and what is not

- **Verified locally and against the development Supabase project:** see the requirement-to-evidence table and the per-phase records in [docs/QA.md](docs/QA.md). In short: 141 unit, static and SQL tests; 293 real-API access and limit tests (including a denial matrix over every data table); browser suites for every phase; the full organiser journey; responsive, accessibility-basics, offline and print audits; the sandbox with the switch on and off.
- **Not run:** any deployed site (public-access, availability-period and email checks below); real-inbox email checks; screen-reader testing; real touch devices; browsers other than Chromium; a second hosted-project dry run of the fresh-setup migrations; load beyond a few hundred rows per list.
- **Known limitations:** see [docs/QA.md](docs/QA.md) "Known limitations" (summary: no realtime sync, so pages refresh on navigation; limits apply to new events and members only; test plans have no recurring billing; typed text is lost when a save fails because the connection dropped, though nothing is reported as saved; built-in email limits; AI-use and legal review are not part of the product).

## 8. Deploy it yourself (Vercel + GitHub + your Supabase project)

Nothing here has been run for you: no repository was pushed, no site was published, and no account or service was bought. Follow the course appendix for the GitHub and Vercel accounts, then:

1. **Choose the Supabase project.** For a graded demo you may reuse the development project or make a second one. Use a project that holds only fictional data. If you make a new one, apply migrations 001 to 008 (section 3, step 5) and check with `npm run check:env`.
2. **Push the repository** to GitHub (a private or public repo as the course requires). `.env.local` and `supabase/_bundle.sql` are git-ignored. Keep out `Lecture/`, the assignment PDF and `.claude/skills/` unless the course says otherwise.
3. **Create the Vercel project** from that repository (framework: Next.js; build command `npm run build`; no output directory change). Add these environment variables for Production (and Preview if you use it):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | your final site URL, for example `https://<name>.vercel.app` (no trailing slash). Set it before the first build; redeploy if you change it. |
   | `NEXT_PUBLIC_SUPABASE_URL` | the project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key |
   | `SUPABASE_SECRET_KEY` | the secret key (mark it **Sensitive**; it is used only by server code) |
   | `PAYMENT_SANDBOX_ENABLED` | `true` for the labelled coursework payment demo; `false` otherwise (see "Sandbox setting") |
4. **Auth redirect configuration** (Supabase → Authentication → URL Configuration): Site URL = your site URL; Redirect URLs include `https://<your-domain>/**`. Keep `http://localhost:3000/**` only while you still develop. Update the email templates (section 3, step 4); `{{ .SiteURL }}` then becomes your site.
5. **Email.** The built-in sender delivers only to addresses on your Supabase team and is rate-limited (see below). For anyone else to receive confirmation or reset emails you must set up custom SMTP in Supabase. Until then, create demo accounts with team-member addresses or turn the pre-made demo into your main marking path (`/demo`).
6. **Deploy, then run the smoke script from your computer:** `npm run smoke -- https://<your-site>` (read-only; it does not sign in or write anything).

### Deployed-site smoke-test checklist (all **not run**; tick them yourself after deploying)
- [ ] `npm run smoke -- https://<your-site>` ends with "All smoke checks passed".
- [ ] The landing page, pricing, privacy and `/demo` open without signing in, on a phone and a desktop.
- [ ] Sign up with a team-member address: the confirmation email arrives, its link opens the site and signs you in (P2.13).
- [ ] Forgot password: the email arrives, the link opens the reset page, a new password works, an expired or reused link shows a plain message (P2.15, P2.16).
- [ ] Create a workspace, an event, a task; refresh; sign out and in; the data is still there.
- [ ] Open another person's workspace link: "Page not found".
- [ ] Plan page: with `PAYMENT_SANDBOX_ENABLED=true` the simulated checkout works and says "Test mode — No real payment taken"; with `false` it says the checkout is switched off.
- [ ] `/dev/kit` is a 404.
- [ ] Print an event summary from the deployed site.

### Availability-period checklist (during marking, **not run**)
- [ ] The site URL in your submission opens on the day you submit and again a few days later.
- [ ] The Supabase free project is **not paused** (free projects pause after about a week without activity; open the dashboard and restore it if needed, or sign in to the app daily).
- [ ] Vercel shows the latest deployment as "Ready" and the environment variables are still set.
- [ ] The demo path in section 4 still works; delete test workspaces you no longer need.

## 9. Built-in email limits (important for testing)

Supabase's built-in email service is for development only. Per Supabase's documentation it delivers only to addresses that belong to your project's team (others fail with "Email address not authorized"), is capped at about 2 messages per hour for the whole project (the value can change; see Authentication → Rate Limits), and has no delivery guarantee. Add your test address as a team member and wait between attempts.

## 10. After the MVP (backlog, not built)

Specialist event templates; supplier referrals as a real revenue line; a public RSVP page and email invitations; calendar export (`.ics`); CSV or PDF export; realtime updates; seat assignment; multi-currency events; an audit log; invitations by email (instead of adding existing accounts); a real payment provider in test mode first (server-held secrets, signed webhooks, idempotent grants); automatic clean-up of old sample and test data; keeping typed text when a network error interrupts a save; server-side search for very large lists. This list matches `PRD.md` section 2.5.

## 11. Author declarations 

- Repository URL: https://github.com/taniaheung-png/sceneset
- Live site URL: https://sceneset-iota.vercel.app/
- AI-use declaration: We declare that 40% of the work involves AI assistance, while the rest is our original contribution, including acknowledged sources and collaborations, per academic regulations.
