# SceneSet — tasklist.md

> **DRAFT for founder review** (AI-drafted 2026-10-25). Nothing is pre-checked. Mark `[x]` only after the stated **Gate** passes; partial/failed/blocked tasks stay `[ ]` with a status note. Requirement IDs (R##) are defined in `PRD.md` §2.1. Execute strictly the first pending task; stop at each phase checkpoint for the founder's manual review and commit. Never stage/commit automatically.

Gate shorthand: **BUILD** = `npm run build` zero errors · **TYPE** = `npx tsc --noEmit` · **LINT** = `npm run lint` · **DEV** = `npm run dev` page renders, no console errors · **DB** = migrations applied to verified dev DB + rows inspected · **VIS** = checked at 375/768/1024/1440 px · **A11Y** = keyboard-only pass + contrast measured.

---

## Phase 0 — Inspect, specify, plan

- [x] **P0.1** Inspect project, tools, skills, Git state. Gate: baseline recorded in `PRD.md` header (empty dir, not a Git repo, Node 22.13, ponytail+frontend-design loaded, ui-ux-pro-max absent).
- [x] **P0.2** Read assignment pp.10, 26–27, 32–43 and cited lecture pages. Gate: coverage and unread image slides disclosed in `PRD.md`.
- [x] **P0.3** Write `PRD.md` (7 sections, rationale, traceability). Gate: all R01–R30 appear in §2.1 and §8.
- [x] **P0.4** Write `tasklist.md`. Gate: every R-ID appears in at least one task below (coverage check in "Coverage matrix" at end).
- [ ] **P0.5** Founder reviews, decides open items, commits manually. *Status: decisions given at Phase 1 start (see PRD decisions list); commit is the founder's manual step.*

## Phase 1 — Foundation and design system  (R01, R25, R26)

- [x] **P1.1** (R01) Install `ui-ux-pro-max` project-locally; read SKILL.md; run `--design-system "event planning desktop workspace"` and record relevance. Gate: result and relevance verdict written to `PRD.md` §3.4. *Done: installed at `.claude/skills/ui-ux-pro-max`; query 1 off-target (rejected), narrower retry accepted.*
- [x] **P1.2** Scaffold Next.js (App Router, TS, Tailwind) in the project root with npm. Gate: BUILD + DEV on `/`.
- [x] **P1.3** Add `.gitignore` (env, `.next`, node_modules), `.env.example` (placeholders, public/private labelled). Gate: `git check-ignore`-equivalent review of file; `.env.example` contains no real values. *Note: Git not initialised, so verified by file review + pattern scan, not git check-ignore.*
- [x] **P1.4** (R25) Define CSS tokens (colour, spacing, type, border, radius, shadow, motion) and load fonts via `next/font`. Gate: tokens in one file; DEV.
- [x] **P1.5** (R25) Measure contrast of every text/background and control token pair; adjust tokens. Gate: script or tool output saved in `docs/QA.md`, all text ≥4.5:1.
- [x] **P1.6** (R25) Accessible primitives: Button, Input+Label, Select, Dialog (focus trap/restore/Escape), StatusChip, CueTab (date/status motif). Gate: A11Y on a scratch page, then removed or kept as `/dev-kit` not linked.
- [x] **P1.7** (R26) App shell: sidebar, header with workspace/event switcher placeholders, collapse menu <1024px. Gate: VIS, no horizontal page overflow.
- [x] **P1.8** (R01) Landing page: audience/problem/outcome, Try demo + Create event CTAs, labelled-placeholder product preview built from CSS/SVG, workflow, pricing link. No fake proof. Gate: VIS incl. 375×667 CTA visible; text review for unsupported claims. *Done: landing + static SamplePreview; temporary 'Prototype build' notice added (remove at P8.9).*
- [x] **P1.9** (R21) Pricing route stub + public nav links (`/`, `/pricing`, `/privacy`, `/login`, `/signup`) that resolve. Gate: DEV click-through. *Done: pricing (static plans, provisional-price notice), privacy (interim), login/signup show 'Not connected yet' instead of forms, /demo preview shell.*
- [x] **P1.10** Add scripts: `lint`, `typecheck`, `test`. Gate: TYPE + LINT + BUILD pass; Phase 1 checkpoint report; confirm no secrets in files.

## Phase 2 — Database, authentication, workspace isolation  (R02–R05, R27, R28)
*Prereq for all: founder supplies a Supabase development project (URL, anon key, optional service key) in `.env.local`. **BLOCKED until supplied.***

- [x] **P2.1** Verify config presence without printing values; confirm target is a development project. Gate: check script prints only set/unset. *Done via `npm run check:env` (prints only pass/fail).*
- [x] **P2.2** Install `@supabase/supabase-js`, `@supabase/ssr`. Gate: BUILD.
- [x] **P2.3** Migration 001: `profiles`, `workspaces`, `workspace_members`, role enum, updated_at trigger. Gate: DB apply + table inspect. *Verified on the dev project: `npm run test:remote` 61/61 on 2026-10-26 (plus 26 local PGlite tests).*
- [x] **P2.4** (R27) RLS helper functions + policies for those three tables. Gate: DB direct test — non-member SELECT returns 0 rows, anon returns 0. *Verified on the dev project: `npm run test:remote` 61/61 on 2026-10-26 (plus 26 local PGlite tests).*
- [x] **P2.5** (R05) Last-owner and self-promotion protections (trigger/RPC). Gate: DB tests — demote/remove last owner rejected; collaborator cannot set own role. *Verified on the dev project: `npm run test:remote` 61/61 on 2026-10-26 (plus 26 local PGlite tests).*
- [x] **P2.6** Migration 002: `venues`, `events` (+ constraints, currency/timezone). Gate: DB; constraint violations (ends<starts, negative target) rejected. *Verified on the dev project: `npm run test:remote` 61/61 on 2026-10-26 (plus 26 local PGlite tests).*
- [x] **P2.7** Migration 003: `tasks`, `schedule_entries`, `notes`, `guests`, `layout_items`. Gate: DB; checks reject bad values. *Verified on the dev project: `npm run test:remote` 61/61 on 2026-10-26 (plus 26 local PGlite tests).*
- [x] **P2.8** Migration 004: `suppliers`, `quotes`, `budget_items` (restrict supplier delete, unique quote link, paid≤committed). Gate: DB negative tests. *Verified on the dev project: `npm run test:remote` 61/61 on 2026-10-26 (plus 26 local PGlite tests).*
- [x] **P2.9** (R27) Same-workspace triggers for assignee/supplier/venue/quote links. Gate: DB — forged cross-workspace ID rejected. *Verified on the dev project: `npm run test:remote` 61/61 on 2026-10-26 (plus 26 local PGlite tests).*
- [x] **P2.10** (R27) RLS policies for all remaining tables per role matrix. Gate: SQL test script `supabase/tests/rls.sql` (or equivalent) all pass: member read, collaborator write denied on budget, cross-tenant denied on read/write/delete/aggregate. *Verified on the dev project: `npm run test:remote` 61/61 on 2026-10-26 (plus 26 local PGlite tests).*
- [x] **P2.11** `entitlement_events` table (sandbox log). Gate: DB. *Verified on the dev project: `npm run test:remote` 61/61 on 2026-10-26 (plus 26 local PGlite tests).*
- [x] **P2.12** Supabase client helpers (browser/server) and session refresh middleware. Gate: BUILD + DEV; no service key in client bundle (grep build output).
- [ ] **P2.13** (R02) Sign-up page + action. Gate: new user row in `auth.users` + `profiles`. *Status: code written; needs a real confirmation email (built-in mailer: project-team addresses only, ~2/hour). Awaiting inbox action; not tested.*
- [x] **P2.14** (R02) Sign-in / sign-out. Gate: session persists across refresh; sign-out clears; protected route redirects. *Verified in a real browser (Playwright, one isolated context per role) against the dev project, 2026-10-26: `npm run test:e2e` 17/17.*
- [ ] **P2.15** (R03) Forgot-password request page. Gate: email sent (or logged by Supabase) — *needs email delivery*. *Status: code written; not tested (email delivery needed).*
- [ ] **P2.16** (R03) Reset-password completion page with expired/invalid-link state. Gate: password changes; old link fails with clear message. *Status: code written; invalid-link redirect verified, valid and expired link paths not tested.*
- [x] **P2.17** (R02) Deep-link protection (redirect to login, return after). Gate: DEV manual test. *Verified in a real browser (Playwright, one isolated context per role) against the dev project, 2026-10-26: `npm run test:e2e` 17/17.*
- [x] **P2.18** (R04) Onboarding: create workspace (creator = owner) via RPC. Gate: DB row + membership; refresh persists. *Verified in a real browser (Playwright, one isolated context per role) against the dev project, 2026-10-26: `npm run test:e2e` 17/17.*
- [x] **P2.19** (R05) Settings → members: add existing account by email, change role, remove (owner only). Gate: direct-API test as organiser/collaborator denied. *Verified in a real browser (Playwright, one isolated context per role) against the dev project, 2026-10-26: `npm run test:e2e` 17/17.*
- [x] **P2.20** (R28) Money (minor-unit parse/format) and timezone helpers with unit checks. Gate: `npm test` — rounding, zero, negative reject, overnight/DST sample.
- [x] **P2.21** Phase 2 gate: two-user test proves anonymous and cross-workspace access denied; record in `docs/QA.md`. Checkpoint report. *Gate met: `npm run test:remote` 61/61 and `npm run test:e2e` 17/17 prove anonymous and cross-workspace denial on the dev project (docs/QA.md). **Phase 2 as a whole stays incomplete:** P2.13, P2.15 and P2.16 need a real inbox and are deferred by founder decision (email confirmation stays ON; no emails sent).*

## Phase 3 — Events, tasks, notes  (R06–R09, R16)

- [x] **P3.1** (R06) Events list route with empty state. Gate: DEV. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.2** (R06) Create-event form (title, dates, timezone, venue, capacity, budget target, currency, goals) with server validation. Gate: row saved; invalid dates rejected with preserved input. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.3** (R06) Edit event with stale-update check. Gate: two-tab edit → second save warns, no silent overwrite. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.4** (R06) Archive vs delete with confirm dialogs. Gate: archived hidden by default; delete cascades children (DB check). *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.5** (R06, R16) Events search + status filter + reset + no-results. Gate: filter doesn't alter data. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.6** (R06) Workspace/event switcher; stable routes. Gate: switching preserves view; guessed event ID of other workspace → not-found. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.7** (R07) Dashboard skeleton: header, date/status cue tab, counts from DB (tasks overdue/upcoming). Gate: counts match DB after changes. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.8** (R08) Task create/edit/delete form. Gate: persists after refresh. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.9** (R08) Task board columns with status change via select/buttons (+keyboard). Gate: A11Y; dashboard counts update. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.10** (R08, R16) Task filters (status, assignee) + reset. Gate: no-results state. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.11** (R08) Collaborator limits (only own assigned task status). Gate: direct write by collaborator to other task denied. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.12** (R09) Event notes (add/edit own; delete own). Gate: permission test. *Verified: `npm run test:e2e:p3` 24/24 in role-isolated browsers against the dev project, 2026-10-26; DB-level rules by `npm run test:remote` 64/64.*
- [x] **P3.13** (R24) Collection notice component placed on forms collecting personal data. Gate: visible on the event, note and member forms (the guest form does not exist yet; P5.1 adds the notice there). *Verified: `npm run test:e2e:p3` 25/25, 2026-10-26. Component `CollectionNotice` shown on the event, note and member forms; the guest form gets it in P5.1.*
- [x] **P3.14** Phase 3 gate: create/edit/refresh/re-sign-in/teammate view checks; update `docs/QA.md`; BUILD/TYPE/LINT. Checkpoint report. *Gate met: create/edit/refresh/re-sign-in persistence and counts, collaborator limits, and event/workspace isolation proven by `npm run test:e2e:p3` 25/25; `test:remote` 64/64; `npm test` 39/39; lint, typecheck, build pass (docs/QA.md). Phase 2 regression `test:e2e` 17/17.*

## Phase 4 — Suppliers, quotes, budget  (R10–R12)

- [x] **P4.1** (R10) Supplier directory CRUD (workspace-level, fictional). Gate: restrict delete when quotes exist, shows message. *Verified in browser (`npm run test:e2e:p4`, supplier steps) 2026-10-26: add, edit, delete; a supplier with quotes cannot be deleted and the message says why.*
- [x] **P4.2** (R10, R16) Supplier category filter/search. Gate: reset + no-results. *Verified in browser: search, category filter, clear and no-results states.*
- [x] **P4.3** (R11) Quote create/edit per event with supplier, amount, scope, status. Gate: persists; cross-workspace supplier forged ID rejected. *Verified: quotes persist after reload and edit; invalid amounts keep typed values including the chosen supplier; a forged other-workspace supplier is rejected by the database (`test:remote`).*
- [x] **P4.4** (R11) Quote comparison table grouped by category; shortlist/accept actions. Gate: ≥2 quotes shown side by side; only authorised roles act. *Verified 2026-10-26 on the dev project: `npm run test:e2e:p4` 27/27 (role-isolated browsers) and `npm run test:remote` 84/84; `npm test` 65/65. Migration 005 applied.*
- [x] **P4.5** (R12) Budget item CRUD with category, planned, committed, paid. Gate: invalid (negative, paid>committed) rejected. *Verified 2026-10-26 on the dev project: `npm run test:e2e:p4` 27/27 (role-isolated browsers) and `npm run test:remote` 84/84; `npm test` 65/65. Migration 005 applied.*
- [x] **P4.6** (R12) Totals panel (planned, committed, paid, outstanding, remaining, variance) with sign explanation. Gate: unit checks incl. empty/zero/over-budget/rounding. *Verified by unit checks (`npm test`, tests/budget.test.mjs: empty, zero target, over budget, exact integer sums, rounding, sign wording).*
- [x] **P4.7** (R12) Accept quote → link to budget item via idempotent RPC (create or choose item). Gate: double-click / repeat creates no duplicate and no double count. *Verified 2026-10-26 on the dev project: `npm run test:e2e:p4` 27/27 (role-isolated browsers) and `npm run test:remote` 84/84; `npm test` 65/65. Migration 005 applied.*
- [x] **P4.8** (R12, R16) Budget category filter; filtered view labels that totals are filtered vs overall. Gate: unfiltered totals unchanged. *Verified 2026-10-26 on the dev project: `npm run test:e2e:p4` 27/27 (role-isolated browsers) and `npm run test:remote` 84/84; `npm test` 65/65. Migration 005 applied.*
- [x] **P4.9** (R12) Stale-update check on budget item edit. Gate: two-tab conflict message. *Verified 2026-10-26 on the dev project: `npm run test:e2e:p4` 27/27 (role-isolated browsers) and `npm run test:remote` 84/84; `npm test` 65/65. Migration 005 applied.*
- [x] **P4.10** (R07) Dashboard budget summary + over-budget warning linking to Budget. Gate: matches Budget totals. *Verified 2026-10-26 on the dev project: `npm run test:e2e:p4` 27/27 (role-isolated browsers) and `npm run test:remote` 84/84; `npm test` 65/65. Migration 005 applied.*
- [x] **P4.11** Phase 4 gate: permissions (collaborator denied), persistence, recalculation; update `docs/QA.md`; BUILD/TYPE/LINT. Checkpoint report. *Verified 2026-10-26 on the dev project: `npm run test:e2e:p4` 27/27 (role-isolated browsers) and `npm run test:remote` 84/84; `npm test` 65/65. Migration 005 applied.*

## Phase 5 — Guests and run of show  (R13, R14)

- [x] **P5.1** (R13) Guest CRUD (name, optional contact, group, party size, RSVP, notes). Gate: persists; collection notice shown. *Verified 2026-10-26: `npm run test:e2e:p5` 19/19 (role-isolated browsers, dev project), `npm run test:remote` 96/96, `npm test` 82/82.*
- [x] **P5.2** (R13, R16) Guest search + RSVP + group filters. Gate: reset + no-results. *Verified 2026-10-26: `npm run test:e2e:p5` 19/19 (role-isolated browsers, dev project), `npm run test:remote` 96/96, `npm test` 82/82.*
- [x] **P5.3** (R13) RSVP summary: records vs attending headcount vs capacity. Gate: unit check of counts incl. party size; over-capacity indicator. *Verified 2026-10-26: `npm run test:e2e:p5` 19/19 (role-isolated browsers, dev project), `npm run test:remote` 96/96, `npm test` 82/82.*
- [x] **P5.4** (R07) Dashboard guest summary. Gate: matches Guests page. *Verified 2026-10-26: `npm run test:e2e:p5` 19/19 (role-isolated browsers, dev project), `npm run test:remote` 96/96, `npm test` 82/82.*
- [x] **P5.5** (R14) Schedule entry CRUD with start/end in event timezone, owner, location, notes; deterministic order. Gate: end≤start rejected; persists. *Verified 2026-10-26: `npm run test:e2e:p5` 19/19 (role-isolated browsers, dev project), `npm run test:remote` 96/96, `npm test` 82/82.*
- [x] **P5.6** (R14) Overnight entry handling and display. Gate: unit + manual test of 23:00→01:00. *Verified 2026-10-26: `npm run test:e2e:p5` 19/19 (role-isolated browsers, dev project), `npm run test:remote` 96/96, `npm test` 82/82.*
- [x] **P5.7** (R14) Overlap and out-of-event-window warnings (non-blocking). Gate: parallel entries still savable. *Verified 2026-10-26: `npm run test:e2e:p5` 19/19 (role-isolated browsers, dev project), `npm run test:remote` 96/96, `npm test` 82/82.*
- [x] **P5.8** (R07) Dashboard schedule overview. Gate: reflects edits. *Verified 2026-10-26: `npm run test:e2e:p5` 19/19 (role-isolated browsers, dev project), `npm run test:remote` 96/96, `npm test` 82/82.*
- [x] **P5.9** Phase 5 gate: role checks, filters, counts; update `docs/QA.md`; BUILD/TYPE/LINT. Checkpoint report. *Verified 2026-10-26: `npm run test:e2e:p5` 19/19 (role-isolated browsers, dev project), `npm run test:remote` 96/96, `npm test` 82/82.*

## Phase 6 — Venue layout, readiness, print, settings, privacy, demo  (R15, R17–R20, R24)

- [x] **P6.1** (R15) Venue create/edit (dimensions) and attach to event. *Note: creating a venue and attaching it to an event already exists in the event form (phase 3); P6.1 adds editing and deleting venues.* Gate: persists.
- [ ] **P6.2** (R15) Layout canvas (SVG, scaled) rendering saved items. Gate: reload shows identical coordinates.
- [ ] **P6.3** (R15) Add/delete layout item (table, stage, entrance, booth, other) with label. Gate: persists.
- [x] **P6.4** (R15) Numeric position/size form with bounds clamping/validation. Gate: unit check of bounds logic; out-of-bounds rejected.
- [x] **P6.5** (R15) Keyboard move/resize (arrows, modifier). Gate: A11Y keyboard-only test.
- [x] **P6.6** (R15) Optional pointer drag (supplements 6.5; same save path). Gate: matches numeric result.
- [x] **P6.7** (R15) Print representation of layout. Gate: print preview shows full venue.
- [x] **P6.8** (R17) Readiness checklist logic (venue set, budget reviewed, key tasks done, run-of-show present, etc.) with documented denominator. Gate: unit check — empty event is 0%, never 100%.
- [x] **P6.9** (R17) Readiness on dashboard with links to fix each item. Gate: links land on right view.
- [x] **P6.10** (R18) Summary route (details, responsibilities, budget, suppliers, guests, schedule, readiness, layout). Gate: authz — other workspace → not-found.
- [x] **P6.11** (R18) Print CSS. Gate: print preview, no nav/controls, no clipping, tables readable.
- [ ] **P6.12** (R19) 'Load demo data' RPC copying a fictional template into the signed-in user's own workspace. Gate: DB — copy visible only to that workspace's members; no real-looking personal data.
- [ ] **P6.13** (R19) Public read-only `/demo` backed by the fixed fictional dataset (no login, no writes) plus 'Reset demo' for the signed-in copy. Gate: anonymous visitor cannot write; reset affects only that user's demo copy (two-user test).
- [x] **P6.14** (R24) `/privacy` page: what is collected, why, retention, deletion, cookies (essential only). Gate: plain-language review.
- [x] **P6.15** (R20, R24) Settings: profile, workspace name, privacy links. Gate: persists.
- [ ] **P6.16** (R24) Account deletion with sole-owner safeguard (transfer or delete workspace first). Gate: blocked when sole owner with members; succeeds otherwise; data gone.
- [x] **P6.17** (R07) Dashboard: every number/check from real data; remove placeholders. Gate: audit list in `docs/QA.md`.
- [ ] **P6.18** Phase 6 gate: layout reload, print, demo reset, deletion; BUILD/TYPE/LINT/VIS. Checkpoint report.

## Phase 7 — Pricing and sandbox upgrades  (R21–R23)

- [ ] **P7.1** (R21) Pricing page: Free HKD 0, Event Upgrade HKD 149/event, Organiser HKD 299/month, cadence + limits per entitlement matrix, labelled provisional. Gate: text review vs `PRD.md` §6.
- [ ] **P7.2** (R22) Entitlement rules in one server module (limits for events/members). Gate: unit checks per plan.
- [ ] **P7.3** (R22) Sandbox checkout route with Success / Cancel / Fail + "Test mode — No real payment taken". Gate: DEV; no card fields exist.
- [ ] **P7.4** (R22) Server action: owner-only, known plan ids only, requires `PAYMENT_SANDBOX_ENABLED`, idempotency key. Gate: non-owner denied; unknown/tampered plan rejected; repeat does not duplicate.
- [ ] **P7.5** (R22) Cancel/Fail log without granting. Gate: entitlement unchanged.
- [ ] **P7.6** (R22) Show saved entitlement in settings/pricing and enforce limits server-side. Gate: persists after re-login; limit message when exceeded.
- [ ] **P7.7** (R23) Illustrative vendor-referral section, visually separate, labelled. Gate: VIS; no links to transactions.
- [ ] **P7.8** Phase 7 gate: full upgrade scenario matrix in `docs/QA.md`; BUILD/TYPE/LINT. Checkpoint report.

## Phase 8 — Verify, fix, polish, hand over  (R25–R30, all)

- [ ] **P8.1** (R29) Run full organiser checklist (11 items) end-to-end; log results. Gate: each item pass/fail in `docs/QA.md` with evidence.
- [ ] **P8.2** Route audit: every route in `PRD.md` §3.1 reachable, no dead controls. Gate: checklist.
- [ ] **P8.3** (R27) Tenant/role audit via direct API/SQL for every table and the summary route. Gate: all denial tests pass.
- [ ] **P8.4** (R25) Keyboard-only and screen-reader landmark pass; contrast re-measure. Gate: A11Y notes.
- [ ] **P8.5** (R26) Responsive audit at 375/768/1024/1440. Gate: VIS, no page overflow.
- [ ] **P8.6** Error/network/validation states: simulate failure and confirm data preserved, no false "Saved". Gate: manual log.
- [ ] **P8.7** Calculation audit (money, readiness, headcount, timezone). Gate: `npm test` passes.
- [ ] **P8.8** Add E2E organiser-flow check (smallest tool, e.g., Playwright) + access-denial checks. Gate: runs green locally.
- [ ] **P8.9** Remove misleading placeholders (incl. PrototypeNotice and /demo preview banner, /dev/kit), update `PRD.md`/`tasklist.md` to implemented state, record limitations. Gate: diff review.
- [ ] **P8.10** (R29) `README.md`: clean setup, migrations, seed/demo, env config, tests, deployment, public-access verification checklist, availability-period checklist, repo/live URL placeholders. Gate: clean-setup dry run on a fresh dev DB.
- [ ] **P8.11** (R29) `docs/QA.md` human testing grid with blank "What went well / Needs improvement / Questions / Ideas" (L5 testing grid) and research log. Gate: blanks remain blank.
- [ ] **P8.12** (R30) Concise future-upgrade list in README. Gate: matches `PRD.md` §2.5.
- [ ] **P8.13** Final build/type/lint/test run and handover summary; mark deployed checks as not run unless run. Checkpoint report.

---

## Deferred (post-launch backlog — not MVP)
Templates, real supplier-referral revenue, public RSVP, email invitations, calendar export, CSV/PDF export, realtime updates, seating optimisation, multi-currency, audit log, Stripe billing.

## Founder decisions (resolved at start of Phase 1)
1. Supabase dev project: still needed for Phase 2 (blocks Phase 2 only).
2. ui-ux-pro-max: installed project-locally.
3. Currency HKD; prices HKD 149/event and 299/month stay provisional, unvalidated hypotheses.
4. Role matrix as in PRD §5. Free-plan limits and add-member-by-existing-account: defaults kept.
5. Demo: public read-only, no login; sign-up required to create/edit; anonymous sign-ins deferred.
6. Git: not initialised by the assistant; founder runs git commands manually.
7. Validation: hand-written, no zod unless Phase 2 justifies it.

## Coverage matrix (R-ID → first implementing tasks)
R01 P1.8 · R02 P2.13–14,P2.17 · R03 P2.15–16 · R04 P2.18 · R05 P2.5,P2.19 · R06 P3.1–6 · R07 P3.7,P4.10,P5.4,P5.8,P6.17 · R08 P3.8–11 · R09 P3.12 · R10 P4.1–2 · R11 P4.3–4 · R12 P4.5–9 · R13 P5.1–3 · R14 P5.5–7 · R15 P6.1–7 · R16 P3.5,3.10,4.2,4.8,5.2 · R17 P6.8–9 · R18 P6.10–11 · R19 P6.12–13 · R20 P6.15 · R21 P1.9,P7.1 · R22 P7.2–6 · R23 P7.7 · R24 P3.13,P6.14,P6.16 · R25 P1.4–6,P8.4 · R26 P1.7,P8.5 · R27 P2.4,2.9–10,P8.3 · R28 P2.20,P4.6,P5.6 · R29 P8.1,8.10–11 · R30 P8.12






