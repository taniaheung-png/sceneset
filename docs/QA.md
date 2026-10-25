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

## Phase 6 — Venue layout, readiness, print, settings, privacy, demo (2026-10-26, PARTIAL: migration 006 not yet applied)
Migration `supabase/migrations/20261026000006_layout_demo_account.sql` is written and passes the local SQL/RLS tests, but it has **not** been applied to the development project. Every gate that needs it is left unticked: P6.2, P6.3, P6.12, P6.13 (reset half), P6.16 and P6.18.

| Check | Result |
|---|---|
| `npm test` (unit + local SQL/RLS incl. migration 006) | **112/112** |
| `npm run test:e2e:p6` with `E2E_NO006=1` | **20/20 passed, 8 skipped** (the 8 need migration 006) |
| Regressions on freshly created test users, one suite at a time | `test:e2e` 17/17, `p3` 25/25, `p4` 27/27, `p5` 19/19 |
| `test:remote` 006 checks | written, **not run** (need the migration) |
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

**Settings, privacy, deletion.** Name saves and persists; the privacy page covers collection, purpose, who sees data, essential-only cookies, retention and deletion, and says it has not had legal review. Deleting a workspace needs its exact name and a wrong name deletes nothing. Account deletion rules (blocked for a sole owner with other members; sole-member workspaces removed with the account; shared records stay with authorship cleared) pass in local SQL tests; the browser steps need migration 006 and the secret key.

**Pending until migration 006 is applied (8 skipped browser steps + remote checks):** save and reload of a layout with identical coordinates; stale layout save refused; venue cannot shrink below its objects and event cannot move to a venue its layout does not fit; sample event load (readiness 9 of 11, same numbers as `/demo`); sample reset affects only the sample, other events and other workspaces; account deletion for a non-sole-owner and for a sole member; `test:remote`.

**Cleanup:** the dev project holds 0 users, workspaces, events, venues, suppliers, guests and tasks after the runs; no existing data was touched. A first p4 run was stopped part-way once p2/p3 had broken its preconditions; its test accounts and workspaces were removed with `npm run dev:users -- delete`.

**Not checked:** screen readers; real-device touch and pointer drag on touch screens; layouts with hundreds of objects; printing in browsers other than Chromium.

## Lessons / unresolved assumptions (Build–Measure–Learn)
- Phase 1 lesson: UI UX Pro Max's first, broad query returned an off-target (wedding) result; a narrower product-type query was needed. Treat the tool as input, not authority.
- Unresolved: all desirability/viability assumptions in `PRD.md` §1.1 remain untested.

## Research log (organiser conversations)
*Empty. Record only real conversations here; none have been held.*

## Human testing grid (L5 testing grid) — fill in during sessions
| What went well | Needs improvement | Questions | Ideas |
|---|---|---|---|
|  |  |  |  |





