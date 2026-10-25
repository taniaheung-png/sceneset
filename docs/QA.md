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

## Lessons / unresolved assumptions (Build–Measure–Learn)
- Phase 1 lesson: UI UX Pro Max's first, broad query returned an off-target (wedding) result; a narrower product-type query was needed. Treat the tool as input, not authority.
- Unresolved: all desirability/viability assumptions in `PRD.md` §1.1 remain untested.

## Research log (organiser conversations)
*Empty. Record only real conversations here; none have been held.*

## Human testing grid (L5 testing grid) — fill in during sessions
| What went well | Needs improvement | Questions | Ideas |
|---|---|---|---|
|  |  |  |  |





