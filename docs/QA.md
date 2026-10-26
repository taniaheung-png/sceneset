# SceneSet — QA evidence

> DRAFT log. Only real commands and outcomes are recorded. Blocked or unrun checks stay unchecked.
> Environment: Windows 11, Node v22.13.0, npm 10.9.2, Next.js 16.4.3 (Turbopack), 2026-10-25.

## Phase 1 — Foundation and design system

| Task | Check | Result |
|---|---|---|
| P1.1 | `ui-ux-pro-max` installed project-locally, SKILL.md read, `--design-system` run | Pass. Query 1 off-target (rejected); retry accepted. Details: `PRD.md` §3.4 |
| P1.2 | `npm run build`; dev server renders `/` with no console errors | Pass (build); dev `/` 200, no console errors |
| P1.3 | `.gitignore` ignores `.env*` except `.env.example`; `.env.example` has no secrets | Pass. After the founder initialised Git, read-only `git check-ignore -v`: `.env.local` is ignored (`.env*`), `.env.example` is not (`!.env.example`). Pattern scan for `sk_live`, `sk_test`, `service_role=…`, JWT-like strings, `postgres://` in non-vendor files: no hits |
| P1.4–P1.5 | `npm run contrast` | Pass: all 21 pairs (text ≥4.5:1, control/focus ≥3:1). Lowest text pair: danger on danger-tint 5.41:1 |
| P1.6 | Dev kit `/dev/kit`: dialog opens with focus inside, Escape closes, focus returns to opener | Pass (browser pane, real key events). `/dev/kit` returns 404 on `npm start` |
| P1.7 | Shell at 1440 and 375; mobile menu `aria-expanded`, Escape closes and restores focus | Pass |
| P1.8 | Landing at 375×667: headline, sub-copy and both CTAs visible without scrolling | Pass (CTAs end ≈460px; screenshot) |
| P1.9 | All public routes return 200; unknown demo view returns 404 | Pass: `/ /pricing /privacy /login /signup /demo /demo/{tasks,budget,suppliers,guests,schedule,layout,summary}`; `/demo/bogus` 404 |
| P1.10 | `npm run lint`, `npm run typecheck`, `npm run build` | Pass (no errors) |

**Viewport sweep** (iframe widths 375, 768, 1024, 1440 × 9 routes incl. a 404): no horizontal page overflow after fixing a header bug (`hidden` conflicting with `inline-flex` made nav overflow at 375px).

**Not checked in Phase 1:** screen-reader behaviour; real-device touch; a Windows high-contrast mode; any deployed site. `npm test` had no tests in Phase 1 (added in Phase 2).

**Demo status:** `/demo` is a static preview with fictional data. It saves nothing and is not the authenticated product.

**Then:** Phase 2 started once the founder configured a Supabase development project (see below).

## Phase 2 — Database, authentication, workspace isolation (IN PROGRESS: email gates open)

**Environment:** Supabase dev project configured by the founder (values never printed). `npm run check:env` result on 2026-10-26:
URL shape ok; public key = publishable; secret key present; **email confirmation ON; anonymous sign-ins OFF; email provider enabled; migrations NOT applied (PGRST205)**.

| Task | Check | Result |
|---|---|---|
| P2.1 | `npm run check:env` prints only pass/fail | Pass |
| P2.2 | SDKs installed, `npm run build` | Pass (`@supabase/supabase-js` 2.118.0, `@supabase/ssr` 0.12.7) |
| P2.3–P2.11 | Migrations written (`supabase/migrations/*.sql`). **Applied to the dev project?** | **Not yet. Gate open.** Logic verified locally only (below) |
| local SQL | `npm test`: 26 tests on in-process Postgres (PGlite) with a *shim* of Supabase's `auth` schema and roles. Covers anon denial, tenant isolation, role matrix, last-owner, forged cross-workspace IDs, column grants, constraints, cascades | Pass (26/26). Found and fixed one real bug: the collaborator task guard blocked FK `SET NULL` actions (member leaving, workspace delete) |
| P2.12 | Build/dev; secret key absent from client bundle | Pass: scanned 777 build files for the secret key value and the `sb_secret_` prefix — not found |
| P2.17 | Signed-out requests to `/w/…`, `/onboarding` redirect to `/login?next=…` (proxy) | Redirect verified in browser. **Return-after-login not tested (needs an account)**; gate open |
| real Auth | Sign-in with a fake account through the real project | Pass: "That email and password do not match an account." shown; typed email preserved; password cleared |
| P2.16 (part) | `/auth/confirm` with a bogus `token_hash` | Pass: redirects to `/login?error=link` with explanation. Valid-link path **untested (needs email)** |
| P2.20 | `npm test`: 6 money/time tests (parse, format, DST, overnight, invalid) | Pass |

**Blocked / unrun (gates stay unticked):** apply migrations to dev DB (P2.3–2.11); sign-up with email confirmation (P2.13); sign-in persistence and sign-out (P2.14); password-reset email, expired and valid link (P2.15–2.16); onboarding persistence (P2.18); member management as owner/organiser/collaborator through the UI (P2.19); real-project RLS test `npm run test:remote` (P2.21).

**Email restriction notes:** the built-in service only delivers to project team addresses and allows ~2 emails/hour (see README). No sign-up or reset emails were sent during this phase's testing.

### Phase 2 verification run against the real dev project (2026-10-26)
- `npm run check:env`: all ok; **migrations applied**; email confirmation ON; anonymous sign-ins OFF.
- `npm run test:remote` (`RLS_TEST_CONFIRM=dev-project`): **61/61 passed** through the public API with real sessions: anon denial (7 tables/RPC), owner/organiser/collaborator/outsider isolation, role escalation and direct membership DML denied, last-owner protection, plan and `event_upgrade` not client-writable, constraints (dates, negative amounts, timezone, party size, RSVP, paid>committed), forged cross-workspace supplier/venue/assignee rejected, supplier-with-quotes delete blocked, quote linked once only, layout bounds, notes ownership, outsider delete/aggregate empty, entitlement log read-only for owners, cascade delete.
- One test expectation corrected: a blocked RESTRICT delete returns SQLSTATE `23503` on the hosted database (`23001` on the local engine); both mean "blocked".
- Cleanup verified: dev project holds 0 users and 0 workspaces after the run (no other records existed or were touched).
- **Ticked:** P2.3–P2.11 (each gate's own checks passed on the dev database).
- **Still open (not verified):** P2.13 sign-up with confirmation email, P2.14 sign-in/out in the browser, P2.15–P2.16 reset email, valid and expired links, P2.17 return-to-page after login, P2.18 onboarding in the browser, P2.19 Settings UI as each role, P2.21 phase gate.

### Phase 2 browser verification (2026-10-26) — `npm run test:e2e`, 17/17 passed
**Tooling:** built-in browser pane has one shared cookie jar, so it cannot hold several roles at once. Added project-local `playwright` 1.64.1 (+ headless Chromium) as a devDependency; no MCP, no global install, no Claude CLI. Each role (owner, organiser, collaborator, outsider) ran in its own browser context against `npm run dev` on `localhost:3000` and the real dev Supabase project.
**Accounts:** disposable, pre-confirmed via the admin API (`npm run dev:users -- create`, deleted afterwards). They exercise the real sign-in page, **not** the confirmation-email path.
First run 14/17: three failures were a test timing race (helper returned while `/app` was still redirecting), not app bugs; fixed in the helper and re-run clean 17/17.

| Gate | Evidence |
|---|---|
| P2.14 sign-in/out | Session survives reload and a second tab; after Sign out the `sb-*` cookies are gone and `/w/<id>/settings` redirects to `/login` |
| P2.17 return to page | Signed-out `/onboarding` → `/login?next=/onboarding` → after sign-in lands on `/onboarding`; `?next=//evil.example/steal` stays on `localhost:3000` |
| P2.18 onboarding | Blank name shows the error and stays; creating "E2E Market Co" opens `/w/<id>`; persists after reload and sign-out/sign-in (`/app` returns to the same workspace) |
| P2.19 members/roles | Owner adds organiser + collaborator; unknown email and duplicate show clear errors; sole owner cannot be demoted; role change and revert; organiser and collaborator see Settings read-only (no add form, role controls, Remove or email column; Leave only); non-member and malformed id get "Page not found"; owner removes organiser via confirm dialog and their access ends; collaborator leaves and loses access. Direct API/RPC denial is covered by `test:remote` (61/61) |

Cleanup: the run's workspace and 4 test users deleted; dev project verified at 0 users, 0 workspaces.

**Founder decision (2026-10-26):** use fictional `@example.test` accounts created pre-confirmed through the dev helper; send no emails; keep email confirmation ON; leave inbox-dependent tests deferred and unticked. P2.21 (access-denial gate) is ticked on the database + browser evidence above.

**Still unverified (need a real inbox; deferred):** P2.13 sign-up confirmation email; P2.15 reset email delivery; P2.16 valid link, reused-link rejection and genuine expiry (kept as three separate checks); P2.21 phase gate.

## Phase 3 — Events, tasks, notes (2026-10-26)
**Tooling:** same role-isolated Playwright contexts as phase 2 (`npm run test:e2e:p3`), disposable `@example.test` accounts created pre-confirmed via `npm run dev:users` (no emails sent; email confirmation stays ON), deleted afterwards. Dev project verified at 0 users / 0 workspaces / 0 events / 0 venues after the runs.

| Run | Result |
|---|---|
| `npm run test:e2e:p3` | **25/25** |
| `npm run test:e2e` (phase 2 regression) | 17/17 |
| `npm run test:remote` | 64/64 (3 new: event delete cascades to tasks, notes, guests; collaborator cannot delete an event) |
| `npm test` (unit + local SQL) | 39/39 (adds form validation, `toLocalInput`, `todayIn`) |
| lint, typecheck, production build | pass |

**What the browser run covered:** empty states (events, tasks, dashboard); event form with invalid input keeps every typed value and explains each field; overnight event (15:00 to 01:00 next day) with new venue, capacity and budget shown correctly in the event timezone; list search, status filter, clear, no-results; edit persists; **stale edit refused** when a second tab saves old data (and the first save is not overwritten); event switcher keeps the section; tasks created with assignee, due date and priority; dashboard counts (To do / In progress / Done / Overdue) equal the saved rows and **do not change when board filters are applied**; overdue warning links to the filtered board; move by buttons and **by keyboard Enter**; edit and delete (with confirmation); collaborator sees the board but cannot create/edit/delete, can move only their own task, cannot create/edit events; notes added by two roles, collaborator can edit only their own, organiser can edit and delete any; persistence after sign-out and sign-in; non-members and other-workspace users get "Page not found" for the workspace, event, tasks and edit URLs (also for a malformed id and for an event id used under a different workspace URL); archive hides, archived view lists, restore returns; delete with confirmation removes the event and its URLs 404; collection notice with privacy link on the member, event and note forms.

**Bugs found and fixed during the run:** none in the product beyond test-timing issues: assertions raced React's post-action form reset (tests now wait for it), and a hidden form field named `id` shadowed `form.id` in the DOM, so it was renamed `item`.

**Known limitations / unchecked:** screen-reader behaviour; real-device touch; the dashboard fetches all tasks of an event (fine at prototype scale, count queries beyond ~1,000 tasks); timezone list is a short fixed list; DST-gap local times pick one valid instant without warning; email-dependent Phase 2 gates (P2.13, P2.15, P2.16) remain deferred.

## Phase 4 — Suppliers, quotes, budget (verified 2026-10-26)

**What exists:** supplier directory (workspace-wide) with search and category filter; per-event quote comparison grouped by category with the lowest marked; shortlist, reject, accept, re-open; accepted quote becomes exactly one budget line via the idempotent `accept_quote()` RPC (migration `20261026000005_accept_quote.sql`); budget lines with planned, committed and paid amounts; labelled totals (planned, committed, paid, outstanding, remaining against target, variance) with sign wording; filtered vs overall totals; over-budget state; stale-edit protection; dashboard budget summary built from the same function and rows as the Budget page.

**Design rules enforced in the database, not only the UI:** a quote can become `accepted` only through `accept_quote()`; repeating it returns the same line and changes nothing (the quote row is locked first, and `budget_items.quote_id` is UNIQUE); linking to an existing line REPLACES its committed amount with the quote amount; while accepted, the quote's amount/supplier/status and the line's committed amount are locked; `reopen_quote()` unlinks but keeps the line; deleting a linked line puts the quote back to shortlisted. Spending is counted once because totals sum budget lines only, never quotes.

| Check | Result (2026-10-26) |
|---|---|
| `npm test` (unit + local SQL on PGlite) | **65/65**: adds 15 budget/amount/form tests and 11 accept/re-open/idempotency/lock tests on the real migration SQL |
| lint, typecheck | pass |
| `npm run test:e2e` (phase 2 regression) | 17/17 |
| `npm run test:e2e:p3` (phase 3 regression, plus new check that a chosen select survives a failed submit) | 25/25 |
| `npm run test:e2e:p4` against the dev project, **before** migration 005 | 12/26: supplier directory, filters, quote form errors, three quotes grouped with lowest marked, delete-blocked message, shortlist/reject persistence and quote stale-edit **pass**; every step that accepts a quote fails because `accept_quote` does not exist yet, and later steps cascade from that |
| `npm run check:env` | reports **migration 005 NOT applied (PGRST202)** |
| `npm run test:remote` | superseded: 84/84 after the migration, see below |

**Bug found and fixed:** after a failed submit React resets the form and a `<select>` returns to its original option (a select's `defaultValue` is not re-read), so the chosen supplier, event type, timezone, currency, status or venue was silently lost while text fields were kept. The event, quote and budget forms now remount when the server returns new values or errors; phase 3 and 4 browser tests assert the chosen option survives.

**Status:** migration 005 was applied by the founder and every Phase 4 task now passes; see the verification below. (The 12/26 run above is the earlier pre-migration run, kept as history.)


### Phase 4 verification after migration 005 was applied (2026-10-26)
- `npm run check:env`: all ok, **migration 005 applied**.
- `npm run test:remote`: **84/84** on the real dev project (adds: direct accepted status refused; collaborator and outsider cannot accept or re-open; **six concurrent accepts return one line with the amount counted once**; committed, quote amount and status locked while accepted; planned and paid stay editable; re-open keeps the line; link into an existing line replaces its committed amount; linking a different quote to a linked line refused; deleting a linked line returns its quote to shortlisted; **accepting into a line already paid more than the quote is refused and leaves the line, the quote and the line count identical**; no line ever has paid above committed; event delete cascades to tasks, notes and guests).
- `npm run test:e2e:p4`: **27/27** (role-isolated Chromium). Covers supplier CRUD, search, filters and the in-use delete message; quote errors that keep typed values and the chosen supplier; side-by-side comparison with the lowest marked; shortlist and reject; stale quote edit refused; **accept creates exactly one line and a double click sends a single request**; accepted quote offers Re-open, not Accept or edit; **accepting into an existing line replaces its committed amount**; exact totals (planned 6,200.50, committed 5,700.50, paid 1,000, outstanding 4,700.50, remaining 4,299.50, variance -500 "Below plan"); invalid amounts rejected with typed values kept and nothing saved; quote-linked line has a read-only committed amount; stale line edit refused; over budget by HKD 1,700.50 on the budget page and dashboard, then restored after deleting the line; category filter leaves overall totals unchanged and labels the filtered panel; dashboard numbers equal the Budget page; re-open then re-accept into the same line gives one line and identical totals; deleting a linked line returns its quote to Shortlisted; **a refused accept (line already paid 900 vs a quote of 800) leaves line, quote and totals unchanged**; collaborator sees everything read-only; empty event with no target shows zeros, "Not set", never NaN or "over budget"; no budget or quote leakage across events; outsiders get "Page not found"; totals unchanged after sign-out and sign-in.
- Regression after the form fix: `test:e2e` (phase 2) 17/17, `test:e2e:p3` 25/25, `npm test` 65/65. Lint, typecheck and production build pass.
- Test-only issues found and fixed (not product bugs): a click racing a re-render, a stale-text match, a wrong expected line count. One real product bug was found earlier and fixed (chosen dropdown option reverting after a failed submit).
- Cleanup: the dev project holds 0 users, workspaces, events, suppliers, quotes and budget lines after the runs. Existing data: none existed.
- **Still deferred and unticked:** Phase 2 email checks P2.13, P2.15, P2.16.
**Not checked:** screen-reader behaviour; real-device touch; amounts above about 9 quadrillion minor units (JSON numbers); email-dependent Phase 2 gates (P2.13, P2.15, P2.16) remain deferred.

## Phase 5 — Guests and run of show (2026-10-26)
No migration was needed: the `guests` and `schedule_entries` tables, constraints, grants and RLS from migrations 002 already cover this phase.

**What exists:** guest list (name, optional contact, group, party size, RSVP, notes) with search and RSVP/group filters, one-click RSVP changes, edit with stale-edit protection, delete with confirmation, a collection notice on the form; a summary that keeps **records** (entries) and **people** (sum of party sizes) apart, with attending headcount = people on confirmed records, capacity remaining, an over-capacity alert and a "could exceed if tentatives come" warning; a running order (activity, start/end in the event's timezone, responsible person, location, notes) shown chronologically with day headings, overnight markers, durations, and non-blocking checks; dashboard cards for guests and the running order built from the same functions and rows as the pages.

**Rules:** order is start, then end, then id (deterministic). `end <= start` is rejected (database CHECK and form), with a hint to use the next day for overnight activities. Back-to-back is not an overlap. A plain overlap is "Runs in parallel", informational only; the same person on overlapping entries and entries outside the event window are warnings. None of them block saving.

| Check | Result |
|---|---|
| `npm test` (unit + local SQL) | **82/82** (adds 17: guest summary incl. party sizes, over/at/under capacity, no capacity, capacity 0; guest and entry form validation; ordering; overnight; timezone and DST; parallel, same-person and window warnings; durations) |
| `npm run test:remote` | **96/96** (adds guest party-size limit, collaborator/outsider denial on guests and schedule, forged responsible person rejected, overnight and parallel entries accepted by the database) |
| `npm run test:e2e:p5` | **19/19** |
| Regressions `test:e2e:p4` / `p3` / `test:e2e` | 27/27, 25/25, 17/17 |
| lint, typecheck, production build | pass |

**Browser run covered:** empty states and the collection notice on the guest form; invalid input keeps every typed value **and the chosen RSVP/person**; five guests give records 5 and people 15 with attending headcount 5 (not 2 records); filters narrow the list while the summary stays identical; exactly at capacity is not flagged, over capacity by 1 is, and "if every tentative guest comes there would be 15" appears; the dashboard guest card equals the page; edit persists, stale second tab refused, delete confirmed and counts update; keyboard-only guest creation; entry validation (end before start and equal start/end) with typed values and chosen person kept; entries entered out of order display chronologically; overnight 23:00 to 01:00 shows "(+1 day)", "Overnight" and "2 h"; parallel entries save, same-person overlap and a 13:00 entry before a 15:00 event start are warned but saved, with a checks panel summarising them; stale entry edit refused and delete confirmed; the dashboard run-of-show card repeats the order and warnings; in a New York event, 12:00 is inside the window and 11:00 is flagged as before it, shown in New York time; collaborator is read-only everywhere and sees the same totals and order; outsiders get "Page not found"; data persists after sign-out and sign-in; no page-level horizontal overflow at 375, 768, 1024 and 1440 px.

**Test-only issues fixed (not product bugs):** the add helpers matched stale banner text instead of waiting for their own new row; a Tab count missed the privacy link between the notes field and the submit button; two assertions compared against the wrong page.

**Cleanup:** the dev project holds 0 users, workspaces, events, guests and schedule entries after the runs; no existing data was touched.

**Not checked:** screen-reader behaviour; real-device touch; a running order beyond a few hundred entries (the overlap check compares every pair); local times skipped or repeated by a DST change get one valid instant without a warning. Deferred Phase 2 email checks (P2.13, P2.15, P2.16) remain unticked.

## Phase 6 — Venue layout, readiness, print, settings, privacy, demo (verified 2026-10-26)
Migration `supabase/migrations/20261026000006_layout_demo_account.sql` was applied to the development project by the owner; `npm run check:env` now reports "migration 006 applied (save_layout exists)".

| Check | Result |
|---|---|
| `npm test` (unit + local SQL/RLS incl. migration 006) | **112/112** |
| `npm run test:e2e:p6` (full, including the 8 steps that need migration 006) | **28/28**, no skips |
| Regressions on freshly created test users, one suite at a time | `test:e2e` 17/17, `p3` 25/25, `p4` 27/27, `p5` 19/19 |
| `npm run test:remote` (against the development project, incl. migration 006) | **118/118** |
| lint, typecheck, production build | pass |

**Why p2/p3 failed in the first combined run, and what was found.** The suites share four accounts and were run back to back without recreating them, and the first p3 ran on accounts left over from p6. p2 passed 17/17 on fresh accounts, so that was an environment ordering problem, not a product regression. The p3 re-run on fresh accounts then showed one real failure: `getByText("1 task is overdue.")` matched two elements, because the new readiness list repeats the text in its hint. That is a test defect caused by an intended UI addition; the assertion now targets the alert banner (`getByRole("alert")`), which is stricter, and p3 passes 25/25. No retry or timeout was added.

**Inspected by eye (screenshots, not only DOM):** the dashboard and summary at 375 and 1440 px, the planner at 1440 px, 375 px and after keyboard moves, the A4 print rendering of the summary, and a PDF of it. Defects found and fixed: table columns in print broke words ("Responsi ble"); fixed with no-wrap headers and short cells, and the PDF text was re-checked (7 pages, no broken words). The dashboard overflowed by 3 px at 1024 px and the summary overflowed at 375 px; both fixed, and no page has page-level horizontal overflow at 375, 768, 1024 or 1440 px.

**Readiness audit (P6.17).** Eleven checks, each computed from saved rows by `buildPlan`/`readiness`, with a "Fix this" link to the view that resolves it. The dashboard has no placeholder numbers.

| Check | Source rows | Passes when | Fix link |
|---|---|---|---|
| Venue chosen | `events.venue_id` | set | layout |
| Budget set up | `events.budget_target_minor`, budget lines | target set **and** at least one line | edit event (no target) or budget |
| Within budget | committed vs target | budget set up and committed does not exceed the target | budget |
| Tasks planned | `tasks` | at least one task | tasks |
| Nothing overdue | open tasks vs event-local today | tasks exist and none overdue | tasks (overdue filter) |
| Supplier quotes decided | `quotes` | quotes exist and none awaiting a decision | suppliers |
| Guest list started | `guests` | at least one record | guests |
| Attendance within capacity | confirmed people vs capacity | capacity set, at least one guest record, and not exceeded | edit event (no capacity) or guests |
| Running order drafted | `schedule_entries` | at least one entry | schedule |
| No same-person clashes | schedule entries | entries exist and no overlap for one person | schedule |
| Venue layout saved | `layout_items` | at least one object | layout |

Percentage = checks passed / 11, shown with its explanation and the "planning aid, not a safety, legal or compliance certification" note. An empty event is 0 of 11; 11 of 11 needs every check; going over budget or capacity takes it back down (all tested).

**Print and summary evidence.** In print mode navigation, side bar, tabs and buttons are gone; sections stay together; tables wrap at A4 width with nothing clipped; the layout SVG prints whole. Members of the workspace can open the summary; another workspace's user and bad ids get "Page not found".

**Settings, privacy, deletion.** Name saves and persists; the privacy page covers collection, purpose, who sees data, essential-only cookies, retention and deletion, and says it has not had legal review. Deleting a workspace needs its exact name and a wrong name deletes nothing. Account deletion rules (blocked for a sole owner with other members; sole-member workspaces removed with the account; shared records stay with authorship cleared) pass in local SQL tests, in `test:remote` and in the browser (account deletion uses the server-only secret key after all checks pass).

**Migration 006 checks (all pass):** a saved layout reloads with identical coordinates; a second tab with stale data is refused and none of its changes are saved; a venue cannot be made smaller than its objects and an event cannot move to a venue its layout does not fit (the database refuses; the event and venue are unchanged); the sample event loads into the signed-in owner's workspace (8 tasks, 12 guests, 8 entries, 11 layout objects, 5 quotes, 5 budget lines; readiness 9 of 11, 82%, same numbers as the public `/demo`); reset replaces only the sample and leaves the user's own events and another workspace alone; collaborators, outsiders and non-members cannot load or reset a sample; clients cannot set the `demo` flag; `save_layout` rejects collaborators, outsiders and out-of-bounds items atomically; a sole owner with other members is blocked from deleting their account and nothing changes; a member who is not the sole owner can delete their account, the shared records stay with authorship cleared, and they cannot sign in again; a user who is the only member of a workspace is deleted with it.

**Cleanup:** the dev project holds 0 users, workspaces, events, venues, suppliers, guests and tasks after the runs; no existing data was touched. A first p4 run was stopped part-way once p2/p3 had broken its preconditions; its test accounts and workspaces were removed with `npm run dev:users -- delete`. One test defect found on the first full p6 run (a venue seeded after the page had loaded was missing from the select list) was fixed by reloading the page; the product behaviour it checks passed in the same step's first half.

**Not checked:** screen readers; real-device touch and pointer drag on touch screens; layouts with hundreds of objects; printing in browsers other than Chromium.

## Phase 7 — Pricing and test-mode upgrades (verified 2026-10-26)
Migrations 007 (plan limits, sandbox checkout) and 008 (sandbox functions made server-only, member-limit fix) are applied to the development project. `npm run check:env` reports 005, 006, 007 and 008 applied. **No Phase 7 step is skipped.** P2.13, P2.15 and P2.16 (inbox checks) remain deferred and unticked.

### Results
| Check | Result |
|---|---|
| `npm run check:env` | all pass, including "migration 007 applied" and "migration 008 applied (sandbox functions are server-only)" |
| `npm run test:remote` (real dev project, full 008 block) | **179/179** |
| `npm run test:e2e` (Phase 2 regression, fresh accounts) | **17/17** (was 16/17 before 008) |
| `npm run test:e2e:p7` (sandbox on, no `E2E_NO008`) | **23/23, 0 skipped** |
| `npm run test:e2e:p7:off` (fresh server started with `PAYMENT_SANDBOX_ENABLED=false`) | **7/7** |
| `npm test` (unit, static and local SQL/RLS on migrations 001 to 008) | **141/141** |
| Regressions run earlier on this code (fresh accounts) | `p3` 25/25, `p4` 27/27, `p5` 19/19, `p6` 28/28 |
| lint, typecheck, production build | pass |
| Secret key in the client bundle | the key's value was searched for in all 34 files under `.next/static` after the build: **0 matches** |

Not rerun after migration 008 because 008 does not touch their behaviour: Phases 3, 4, 5 and 6 (their workspaces are marked Organiser by the test setup, so the limits and the member-limit fix are not exercised).

### Defects found while verifying, and their status
1. **Disabled-switch bypass (closed).** With 007 an owner's session could call `sandbox_checkout` through the public API, around `PAYMENT_SANDBOX_ENABLED`. Evidence: `test:remote` before 008 got 22023 (the call reached argument validation, not a privilege refusal). After 008: the 007 signatures return PGRST202 for owner, organiser, collaborator and outsider, and the new signatures return 42501 for the owner, organiser, collaborator, outsider and an anonymous caller (remote and browser suites).
2. **Duplicate member at the free limit reported the plan limit (closed).** `test:e2e` (Phase 2) failed 16/17 with exactly 3 members; after 008 it passes 17/17, and `test:remote` checks the duplicate returns 23505 at the limit.
3. **Test defects (closed).** Seeding with the admin key bypasses RLS but not the limit trigger, so the Phase 6 suite now marks its workspace Organiser. Early remote checks used request keys the key rule rejects; keys are now plain tokens, so each rejection is for the stated reason. A strict-locator failure in the Phase 7 suite was fixed with `.first()`. The raw-request replay used a field-name pattern that missed React's `_1_` prefix, so the control replay did not upgrade; after the pattern was corrected the control passes, which is what makes the disabled-server refusals meaningful.

### Verified through ordinary authenticated application flows
- **Free plan.** The first event is created by the owner's session (no admin fixture); a second active event is refused with the plan message and nothing is created; the first three members work; a fourth is refused with the plan message and nothing is added (browser), and the same limits hold at the database through real sessions (`test:remote`).
- **Owner only; scope.** Organiser, collaborator and outsider sessions have no controls and get "Only workspace owners…" or "Page not found"; tampered hidden fields (unknown plan, free plan, short key, event with the organiser plan, missing event, malformed event, another workspace id, another workspace's event) are refused and change nothing; the server path (secret key) still refuses an actor who does not own the workspace and an event from another workspace (42501 and P0002). The other workspace's plan, events and log stayed untouched.
- **Actor identity.** The server action takes the actor from the verified auth session (`requireUser` then `actor: user.id`); no form field, URL parameter or client-submitted value is read for it. A static test checks both actions and the checkout page, and the browser tamper test cannot change who acts.
- **Cancel and failure.** Logged as cancelled and failed; plan, event upgrade and limits unchanged.
- **Success.** Event Upgrade applies to that event only, raises the member limit to 10 (a fourth member is then accepted) and leaves the event limit at 1; the printed summary drops the SceneSet footer for that event only; Organiser removes both limits (a second active event is created) and also drops the footer.
- **Replay protection.** The same request key in a second tab returns "already processed" and writes no second log row; a fresh key for something already covered is refused; a cancelled key can never become a success; a key cannot be reused for another plan or workspace.
- **Persistence.** The plan survives a refresh and a sign-out and sign-in; a hand-typed `?r=success` URL grants nothing and shows no banner.
- **Downgrade.** Ending the Organiser plan keeps the event upgrade, every event and every member and note; existing records stay editable; a new event is refused while events are active; the member limit applies to new members (checked in detail at the database: 4 members and 2 active events survive the downgrade; additions are refused at 4 and at 3 members; allowed below 3; one new event is allowed only when none is active).
- **Disabled sandbox (fresh server, flag false).** The plan page says the checkout is switched off; the owner sees no upgrade or end-plan control; the checkout page refuses; replaying the real captured checkout request (success, cancellation, failure and an event upgrade) and the real captured end-Organiser request directly against the server is refused and leaves plans, upgrades and the checkout log unchanged (the server recognised the action, so the refusal comes from the switch); the owner's own session is refused (42501) when calling either database function or writing the plan columns directly. The free limits still apply with the sandbox off.
- **Everything works on Free.** Every view of a Free workspace's event opens and a task can be added; no feature is behind a plan wall.

### Visual inspection
Pricing page (1440 px), Plan page (1440 and 375 px), checkout page (375 px): no horizontal overflow at 375 or 1440 px. Defects found and fixed earlier: a lowercase sentence after "Provisional prices.", a duplicated test-mode sentence, and unclear text on the Event Upgrade card with no event.

### Known limits
Limits apply to new events and members only; a workspace that falls back to Free keeps what it has. There is no recurring billing, so Organiser never renews or expires by itself. Test plans and account deletion need the server's secret key at runtime; without it the sandbox reports "switched off". The captured-request replay depends on Next.js server-action wire format and on action ids staying stable across a server restart (they did in this run); if a future Next.js version changes either, the disabled suite fails loudly ("the server did not recognise the captured action") instead of passing. Screen readers and real devices were not tested. Intended `PAYMENT_SANDBOX_ENABLED` values are in `README.md` and `PRD.md`.

### Cleanup
The development project holds 0 users, workspaces, events and checkout log rows after the runs; no existing data was touched.

## Phase 8 — Final verification, polish and handover (2026-10-26)
Scope: confirm each requirement against real evidence, run the complete organiser journey with isolated fictional accounts, run one final sequential pass, inspect the finished interface, review security and configuration, and finish the documentation. No feature was added. **Nothing was deployed; deployed-site checks and real-inbox checks were not run.**

### Final verification pass (one sequential run, fresh accounts for every browser suite)
| Check | Result |
|---|---|
| `npm test` (unit, static and SQL/RLS on all eight migrations from an empty database) | **141/141** |
| `npm run check:env` | all ok (migrations 005 to 008 probed; 001 to 004 by the table probe) |
| `npm run test:remote` (real development project, real API, including the all-tables denial matrix) | **293/293** |
| `npm run test:e2e` (Phase 2) | **17/17** |
| `npm run test:e2e:p3` / `p4` / `p5` | **25/25** / **27/27** / **19/19** |
| `npm run test:e2e:p6` | **28/28** |
| `npm run test:e2e:p7` (sandbox on) | **23/23 (see defect 6: one test timing defect was fixed, then it passed)** |
| `npm run test:e2e:p7:off` (fresh server, `PAYMENT_SANDBOX_ENABLED=false`) | **7/7** |
| `npm run test:e2e:p8` (complete journey and audits) on a production build (`next start`) | **17/17** |
| `npm run smoke` against that production build | **35/35 checks** |
| `npm run contrast` | all 21 pairs pass |
| lint, typecheck, production build | pass, 0 warnings |
| Secret key in the client bundle (value searched in every file under `.next/static`) | 0 matches in 35 client files |

**Remaining skips: none in any suite.** What was not run is listed under "Not verified" below.

### The complete organiser journey (`e2e/phase8.mjs`, Free workspace, no admin fixtures)
| # | Step | Result |
|---|---|---|
| J1 | Create a workspace and an overnight event (venue, capacity, budget target) | pass |
| J2 | Add an organiser and a collaborator; role restrictions in the UI; a non-member reaches no route | pass |
| J3 | Tasks (assign, move), notes, collaborator limits | pass |
| J4 | Compare suppliers and quotes; accept one quote: exactly one budget line | pass |
| J5 | Manual budget line with a paid amount; totals match the dashboard | pass |
| J6 | Guests and RSVPs; confirmed headcount against capacity | pass |
| J7 | Overnight running order (+1 day, ordering) | pass |
| J8 | Save a venue layout; reload; kinds and coordinates persist | pass |
| J9 | Readiness 11 of 11; the printed plan (A4-wide page, PDF text) has every section and no controls | pass |
| J10 | Free limits refuse a second event and a fourth member; Event Upgrade and Organiser (cancel then success) change the limits | pass |
| J11 | Refresh, sign out, sign in: every saved view is identical | pass |
| J12 | A non-member still reaches nothing; the only owner cannot be demoted | pass |

The journey uses pre-confirmed fictional accounts. **That is not evidence that confirmation, reset or any other email is delivered.** P2.13, P2.15 and P2.16 remain deferred and unticked.

### Audits added in Phase 8 (all in `e2e/phase8.mjs`)
- **Responsive (R26):** 12 signed-in views at 375, 768, 1024 and 1440 px: no page-level horizontal overflow.
- **Accessibility basics (R25):** every signed-in and public page has exactly one `h1` and one `main`; every `nav` is named; every visible form control has a label; every button and link has a name; buttons and fields are at least 44 px tall; the first Tab stop is the skip link and it works; the next twelve Tab stops on the dashboard each show a focus indicator. Screen readers were **not** used.
- **Errors and network (P8.6):** a task saved while the browser is offline shows "Something went wrong… may not have been saved", never "Task added"; after reconnecting no task was added and earlier data is intact. Typed text is not kept in that case (documented limitation).
- **Unknown ids and redirects:** malformed and unknown workspace, event and demo ids give the same plain "Page not found" (signed in and out); a signed-out deep link goes to sign-in with a return path; an off-site `next` is not followed.

### Defects found by this phase and fixed
1. **Sideways page scroll on the events list and Settings at 375 px (real defect).** Visually hidden table text was absolutely positioned against the page when a table sat in a scroll container, widening the page by 130 to 270 px once the pages held real rows. The earlier sweeps used smaller data. Fix: scroll containers are positioned (`globals.css`). Re-measured: no overflow at 375, 768, 1024 or 1440 px on all 12 views.
2. **Landing-page illustration disagreed with the product (misleading placeholder).** It showed "4 of 6 checks" and different budget numbers; the product has eleven readiness checks. The illustration now uses the same eleven checks (9 of 11) and the demo's numbers, and still says it is a static illustration.
3. **Missing error and loading states.** A failed save fell back to the framework default. Added a plain error page (`error.tsx`) and a loading state for workspace pages.
4. **Temporary build notice removed.** The "Prototype build, phase N of 8" banner is gone; the permanent disclosures (footer, pricing note, demo banner, test-mode checkout banner, printed footer) remain and are checked by `npm run smoke` and the journey.
5. **Basic hardening headers added** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`); checked by `npm run smoke`.
6. **A test timing defect exposed by the new loading state (test defect, diagnosed with evidence).** In the final pass `test:e2e:p7` failed 5 steps (18/23); an immediate rerun passed 23/23 with unchanged code. Instrumenting the assertion and running it three times gave two failures whose page text was literally "Loading…" and one pass: the test read the checkout page before it had rendered, because workspace pages now show a loading fallback first. The product was correct (the page renders a moment later). The test now waits for the checkout banner before reading, and then passed 23/23. The five failing steps were the upgrade step and the four that depend on it.
7. **Test-only races (not product defects):** the planner's add-object form resets after each add, so the test now waits for the reset before choosing the next kind; print was checked at desktop width in the first attempt, but a printer lays out at paper width, so print is checked in an A4-wide page (as in Phase 6).

### Security and configuration review
- **Tenant isolation and roles:** `test:remote` now runs a matrix over all ten workspace data tables plus workspaces, members, profiles and the entitlement log: anonymous cannot read; a non-member reads nothing and cannot insert, update or delete; a collaborator can read but cannot insert, update or delete another person's row (notes excepted for inserts); and every denied row survives. The print summary route is covered by the journey and Phase 6 (non-members get "Page not found").
- **Secrets:** `SUPABASE_SECRET_KEY` is imported only by two server-action files (static test); no client file mentions it; the built client files do not contain its value; no `NEXT_PUBLIC_` variable carries a secret.
- **Safe redirects:** off-site `next` values are ignored on sign-in and on the email-link route (tested in the browser and by `npm run smoke`).
- **Deletion safeguards:** typed confirmation for workspace and account deletion; last-owner protection; a sole owner with other members is blocked (Phase 6 suites).
- **Sandbox boundary:** off by default; the database functions are server-only; replayed raw requests, direct API calls and tampered forms are refused (Phase 7 suites, including the switched-off server).
- **Development-only routes and tools:** `/dev/kit` is a 404 in a production build (checked on the `next start` run). `dev:users` and `test:remote` refuse to run without `RLS_TEST_CONFIRM=dev-project`; they are scripts, not routes.

### Requirement-to-evidence summary (R01 to R30)
"Verified" means the behaviour was exercised in a browser or through the real API against the development project (or locally) in the named suite; an ID appearing in a document is not proof.

| ID | Requirement | Route or workflow | Evidence | Status |
|---|---|---|---|---|
| R01 | Landing page | `/` | Phase 1 sweep and 375 px first-screen check; landing screenshot inspected; `smoke` disclosure check; illustration fixed in Phase 8 | verified locally; deployed site not run |
| R02 | Sign-up, sign-in, sign-out | `/signup`, `/login` | `test:e2e` (return path, safe redirect, session survives reload and second tab, sign-out); journey J11 | sign-in/out verified; **sign-up confirmation email deferred (P2.13)** |
| R03 | Password reset incl. completion and expired states | `/forgot-password`, `/reset-password`, `/auth/confirm` | pages load (`smoke`, Phase 1 sweep); the email link flow needs a real inbox | **not verified end to end (P2.15, P2.16 deferred)** |
| R04 | Workspace creation and roles | `/onboarding` | `test:e2e`; J1, J2 | verified |
| R05 | Member management, last-owner protection | `/w/[ws]/settings` | `test:e2e` (add, unknown, duplicate, role change, last owner, remove, leave); `test:remote`; local SQL; J2, J12 | verified |
| R06 | Events list, create, edit, archive, delete | `/events`, `/events/new`, `/edit` | `test:e2e:p3`; J1 | verified |
| R07 | Dashboard counts from saved records | `/events/[ev]` | p3 to p6 count-match steps; J5, J6, J9 | verified |
| R08 | Task board | `/tasks` | p3 (create, assign, move, filters, collaborator rules); J3 | verified |
| R09 | Notes | `/tasks` | p3 (role-based edit rights); J3 | verified |
| R10 | Supplier directory | `/suppliers` | p4; J4 | verified |
| R11 | Quote comparison, shortlist, accept | `/suppliers` | p4; remote; J4 | verified |
| R12 | Budget, totals, accepted quote becomes one line | `/budget` | p4 (double click, re-open, delete, stale edit); unit; J4, J5 | verified |
| R13 | Guests, RSVP, headcount against capacity | `/guests` | p5; unit; J6 | verified |
| R14 | Run of show with warnings, overnight | `/schedule` | p5 (ordering, overnight, timezone, warnings); unit; J7 | verified |
| R15 | Venue layout (2D, numbers and keyboard, saved) | `/layout` | p6 (keyboard, numeric bounds, drag, atomic save, stale save, venue fit); J8 | verified |
| R16 | Search and filters, reset, no-results | each list | p3 (events, tasks), p4 (suppliers), p5 (guests) | verified |
| R17 | Readiness, explained | dashboard | unit; p6 (0%, each fix, 100%); J9 (11 of 11) | verified |
| R18 | Print-friendly summary, authorised only | `/summary` | p6 and J9 (print emulation, PDF text, no controls, non-members 404) | verified (Chromium print only) |
| R19 | Fictional demo, read-only; editable sample in own workspace | `/demo`, Events | p6 (public demo equals app rules; sample load/reset isolation); remote | verified |
| R20 | Settings (profile, workspace, privacy, deletion) | `/settings` | p6 | verified |
| R21 | Pricing page | `/pricing` | p7; unit (numbers against `PRD.md`); `smoke` | verified |
| R22 | Test-only payment sandbox | `/upgrade`, `/upgrade/sandbox` | p7, p7:off, remote, local SQL | verified |
| R23 | Illustrative vendor referral | `/pricing` | p7 (separate, labelled, no links); screenshot | verified |
| R24 | Privacy page, collection notices, deletion | `/privacy`, forms, `/settings` | p6; collection notices on the member, event, note and guest forms (p3, p5) | verified; not legally reviewed |
| R25 | Accessibility baseline | all | `contrast` (21 pairs); Phase 8 audit (landmarks, labels, names, 44 px, skip link, focus); planner keyboard (p6) | automated and keyboard checks verified; **screen readers not tested** |
| R26 | Responsive 375/768/1024/1440 | all | Phase 8 sweep (12 signed-in views); Phase 1 sweep (public) | verified; real devices not tested |
| R27 | Tenant isolation everywhere | all | `test:remote` matrix and earlier checks; local RLS tests; browser not-found checks in p3 to p8 | verified |
| R28 | Money in minor units, timezone | budget, schedule | unit tests; p4 amounts; p5 New York event; J7 | verified |
| R29 | Organiser checklist and testing grid | README section 6; QA grid | checklist written; automated equivalent is J1 to J12; grid left **blank** (no human sessions held) | checklist done; **human sessions not held** |
| R30 | Concise post-MVP list | README section 10 | matches `PRD.md` section 2.5 | done |

### Not verified (and why)
- **Any deployed site:** nothing was deployed. Public-access, availability-period and deployed email checks are listed as unticked checklists in `README.md` section 8.
- **Real-inbox email (P2.13, P2.15, P2.16):** sign-up confirmation, forgot-password and reset completion, including expired and reused links.
- **Screen readers, real touch devices, browsers other than Chromium, Windows high-contrast mode.**
- **A fresh-project hosted dry run** of migrations 001 to 008 applied to a brand-new Supabase project in one go (the local in-memory Postgres does apply all eight from empty).
- **Load:** lists beyond a few hundred rows; concurrency beyond the stale-edit and idempotency tests.
- **Legal review** of the privacy page and terms; **price validation** (prices are hypotheses).

### Known limitations
Pages refresh on navigation (no realtime); limits apply to new events and members only; the sandbox has no recurring billing; sample and test data are not cleaned up automatically; typed text is lost when a save fails because the connection dropped (nothing is reported as saved); on a phone the guest and budget tables scroll sideways inside their own box; built-in Supabase email is development-only and rate-limited; the printed plan was checked in Chromium only.

### Cleanup
The development project holds 0 users, workspaces, events and checkout log rows after the runs; no existing data was touched. All test processes were stopped before this record was finished.

## Design redesign (reference-led): checkpoint A of three
Scope of this checkpoint: reference analysis, shared tokens and primitives, the application frame (sidebar, top bar, breadcrumbs, mobile drawer, event navigation) and one fully working event dashboard. Everything else adopts the new tokens automatically (colours, Inter, radii, buttons, fields, pills, date tile) but its own layout is **not yet redesigned**: that is checkpoint B. Checkpoint C (audit, polish, full regression) has **not** been run.

**Skills used.** Impeccable 4.7.1 (read `SKILL.md`, ran `context`, read `init`, `new-work`, `craft-floor`, `operate`; ran the mechanical `detect` over the changed files: 0 findings), UI UX Pro Max (project-local `SKILL.md` read; its keyboard/target-size and contrast rules applied; the search script was not run because the reference, not a search, sets the direction), frontend-design, and Ponytail (shared CSS and existing components changed instead of new components; one new shell component, one new icon set, no new dependency). `PRODUCT.md` was written from `PRD.md` without an interview, as instructed.

**One conflict, decided for the reference.** Impeccable's craft floor bans an eyebrow label above a heading and discourages a metric-card row. The reference uses both as its signature, and the founder's brief says the reference governs, so both are kept.

**Reference.** Inspected live in the built-in browser: Overview, Events, Tasks, Budget, Suppliers, Guests, Schedule at 1440 px and the phone layout of Overview. The full computed styles and stylesheet were read (sidebar 248 px, top bar 66 px, Inter, cream/paper/navy/coral palette, 11 px cards, 8 px buttons, pills, date tiles, metric cards, navy summary card, breakpoints at 1120, 820, 640 and 380 px). Observed values, deliberate adaptations and assumptions are in `docs/design/REFERENCE.md`. Screenshots: `docs/design/reference/`, before: `docs/design/before/` (16 views at 1440 and 375 px), after: `docs/design/after/`, side by side: `docs/design/compare-dashboard-1440.png` and `compare-dashboard-375.png`.

**Changed.** `src/app/globals.css` (tokens, shared component classes), `src/app/layout.tsx` (Inter), `AppShell` (new), `PageHeader`, `Brand`, `Button`, `StatusChip`, `CueTab` (now the date tile), `Field`, `EventNav`, `DashboardView`, `ReadinessPanel`, the workspace and event layouts, the demo layout and demo headers, `scripts/contrast.mjs` (30 pairs), `e2e/design-shots.mjs` (screenshots with believable fictional data through the real pages), `PRD.md` section 3.4, `PRODUCT.md`. Removed: `SideNav` (replaced by `AppShell`) and the tab bar (event views moved into the sidebar; Edit event and Print summary are header buttons). Routes, actions, data, permissions and calculations are untouched.

**Verification run for this checkpoint (fresh accounts, sequential):**
| Check | Result |
|---|---|
| `npm run lint`, `typecheck`, production `build` | pass |
| `npm run contrast` | all 30 pairs pass |
| `npm test` | 141/141 |
| `test:e2e` (Phase 2: sign-in, members, roles, sign-out) | 17/17 |
| `test:e2e:p3` (events, dashboard counts, task board, notes, isolation) | 25/25 with the original assertions |
| `test:e2e:p6` | 27/28 on the first run; the one failure was a real regression (the redesigned demo layout no longer showed the sample event's title). Fixed (title is now the page heading and the sidebar group label); the demo step and the sample step then passed on a targeted rerun (3/3 with setup). Print, planner, settings, deletion steps passed in the first run |
| Impeccable mechanical detector over the changed files | 0 findings |

**Not yet verified (planned for B and C):** the other signed-in screens beyond the shared tokens; the public landing, pricing and authentication pages; keyboard, focus, contrast and reduced-motion walk-through of the new frame; layouts at 768 and 1024 px (only 1440 and 375 px were captured for the dashboard); the rendered printable summary under the new styles (the Phase 6 print step passed, but its output was not re-inspected visually); Phases 4, 5, 7, 8 browser suites; the phone drawer was exercised only by its code paths (existing tests do not open it).

**Known gaps and decisions for you:** the sidebar has no count badges (the reference has them; they need extra queries per page); text is larger than the reference's by design (see REFERENCE.md); the event switcher moved into the sidebar; the reference's "All changes saved" line is not reproduced; a workspace-level overview page was not added (it would be a new route).

## Deployed-site verification (PENDING: none of this has been run)
Fill this in yourself after you deploy, with real results only. Leave a row blank if you did not run it. The deployed URL and the dates are yours to supply.

- Deployed URL: ______________________  Date checked: ______________  Checked by: ______________
- Environment: `PAYMENT_SANDBOX_ENABLED` = ________ (the coursework demo uses `true`)
- Database: new project / existing development project (circle one). It must hold fictional data only.

| Check | Result (pass / fail / not run) | Notes |
|---|---|---|
| Fresh-project dry run (README 3a): `check:env` all ok |  |  |
| Fresh-project dry run: `rls-remote-test` passes |  |  |
| Fresh-project dry run: `e2e/phase8.mjs` passes |  |  |
| `npm run smoke -- <deployed URL>` ends with "All smoke checks passed" |  |  |
| Landing page opens signed out, on a phone and a desktop |  |  |
| `/demo` opens signed out, is read-only and says it is fictional |  |  |
| Protected routes (`/app`, `/onboarding`, a `/w/...` link) send a signed-out visitor to sign-in |  |  |
| `/dev/kit` is a 404 |  |  |
| Sign in with a pre-confirmed fictional account created with the `dev-users` script against this project |  |  |
| Create a workspace, an event and a task; refresh; sign out and in: still there |  |  |
| A second account cannot open the first account's workspace link ("Page not found") |  |  |
| Plan page with the sandbox on: simulated checkout works and says "Test mode — No real payment taken" |  |  |
| Plan page with the sandbox off (after changing the variable and redeploying): says it is switched off |  |  |
| Print preview of an event summary on the deployed site |  |  |
| **Deferred, needs a real inbox:** sign-up confirmation email (P2.13) |  | not run unless you test it |
| **Deferred, needs a real inbox:** forgot-password email (P2.15) |  | not run unless you test it |
| **Deferred, needs a real inbox:** reset completion and expired link (P2.16) |  | not run unless you test it |

Limitation to keep in your submission: pre-confirmed accounts prove the product works on the deployed site; they do **not** prove that Supabase delivers confirmation or reset emails.

## Lessons / unresolved assumptions (Build–Measure–Learn)
- Phase 1 lesson: UI UX Pro Max's first, broad query returned an off-target (wedding) result; a narrower product-type query was needed. Treat the tool as input, not authority.
- Unresolved: all desirability/viability assumptions in `PRD.md` §1.1 remain untested.

## Research log (organiser conversations)
*Empty. Record only real conversations here; none have been held.*

## Human testing grid (L5 testing grid) — fill in during sessions
| What went well | Needs improvement | Questions | Ideas |
|---|---|---|---|
|  |  |  |  |





