# SceneSet — Product Requirements Document

> **Submission version.** MKTG 4150 NPM 2627 T1, Team Assignment 1, app 4 (SceneSet). Drafted with AI assistance and then reviewed, built and tested by the student; the AI-use declaration is on the cover page and in `README.md` §11. Prices and customer assumptions are unvalidated hypotheses, and nothing here is validated customer evidence. All data in the app is fictional.

**Status key.** *[SRC]* = requirement from the assignment (PDF page cited). *[USER]* = requirement from the founder's build brief. *[ASM]* = implementation assumption or hypothesis, changeable. Prices, permissions and engineering choices are **[ASM]**, not instructor requirements.

**Founder decisions recorded at the start of Phase 1** (reversible unless stated):
1. `ui-ux-pro-max` installed project-locally (done; see §3.4).
2. **Demo = read-only fictional demo without login** (`/demo`). Creating or editing persistent workspaces requires sign-up. Anonymous sign-ins are **deferred** (not in MVP). Signed-in users may load an isolated *editable* fictional copy into their own workspace (Phase 6).
3. Prices HKD 149/event and HKD 299/month stay as provisional, **unvalidated pricing hypotheses**, labelled as such wherever shown.
4. Role matrix as in §5 (owner / organiser / collaborator).
5. Image-only-slide limitation stays documented; no visual inspection is claimed.
6. Supabase configuration does not block Phase 1. Database/auth tasks (Phase 2) stay unchecked until they can be tested against a real development project.
Implementation assumptions made in Phase 1: Next.js 16.4.3 scaffold (`cacheComponents`/`partialPrefetching` switched **off** for simpler cookie-session pages; revisit if caching is needed); hand-written validation, no zod yet (Ponytail: add only if justified in Phase 2); no component library beyond five small primitives; native `<dialog>` for modals; temporary "Prototype build" notice on public pages and an in-shell "Preview, not the working app" banner on `/demo` (both removed in Phase 8; see section 9).

**Source coverage (Phase 0 disclosure).**
- Read as text: assignment pp. 10, 26–27, 32–43; L1 pp. 5–8, 14–26; L2 pp. 10–20, 31–38, 48–49, 60–72; L3 pp. 14–16, 25–26, 30–39, 42–46; L4 pp. 36–46, 60–78; L5 pp. 40–42, 49–52, 57–92; L6 pp. 49–51, 62–78, 80–117; L7 pp. 5–36, 40–87.
- **Not visually inspected:** image-only slides (no PDF page renderer installed; I did not install one). Includes L1 pp. 14 and 18 (value-equation graphics; the text versions on L1 pp. 5–6 and 15–23 were used), L5 pp. 59/63/66/68/73–74/77/81–82/85/87/89–91 (persona, journey, HMW, sketching diagrams), L6 pp. 69/81/83/85/87/89/92/94/99/101/104/109–110 (diagrams and videos), L7 pp. 41/53–54/56/72/75/79/81/83. The persona, journey and sketch content below follows each slide's text, not its image.
- **Skills actually loaded:** `ponytail` (full), `frontend-design`, and (from Phase 1) `ui-ux-pro-max`. It was absent in Phase 0; in Phase 1 it was installed **project-locally** at `.claude/skills/ui-ux-pro-max` from https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (commit `d14efff`, 2026-10-23; `scripts/tests` and non-skill repo files not copied; scripts inspected, no network/exec calls). Not installed globally; nothing overwritten. Its SKILL.md was read and `search.py --design-system` run (results in §3.4).
- **Environment:** Node v22.13.0, npm 10.9.2, Python 3.13. Project dir is empty of code and is **not a Git repository** (no baseline commit). `psql`, `supabase` CLI absent. No Supabase credentials observed. Phase 2 is **blocked** until the founder supplies a Supabase development project (see §6).

---

## 1. Executive overview and personas

**Problem.** Event plans become unreliable when budgets, suppliers, guest information, tasks, venue layouts and schedules live in separate documents and conversations. [SRC p.10]

**Value proposition.** One current plan so small event teams can coordinate responsibilities, control spending and prepare a clear running order with less confusion.

**Audience.** Independent organisers, community groups, student societies, small agencies, pop-up market organisers [SRC p.26]. **Beachhead hypothesis [ASM]:** repeat organisers of small events (pop-up markets, society showcases) — the assignment says regular organisers are likelier to pay than one-off private-party hosts [SRC p.10]. All listed groups must still be able to use the product.

**Core value loop.** Sign up → create workspace → create event → set dates, venue, goals → plan tasks, suppliers, budget, guests, schedule, layout → collaborate → review readiness → print the plan.

### 1.1 Product rationale (lecture methods applied to decisions)

**L1 — Value and switching cost (pp. 5–8, 14–26).** L1 gives two framings: *perceived benefits − perceived costs = customer value* (pp. 5–6) and *Total Get vs Total Give* (pp. 15–23). They are related but not the same expression, so neither is used as a formula here; both guide copy. Get: functional (one plan for budget/suppliers/schedule), emotional (reassurance nothing is forgotten — a hypothesis). Give: price, learning effort, time, risk, switching cost from spreadsheets and chat threads (p. 23). Decisions: a 3-field first-event form; one-click fictional demo; plain prices; copy about outcomes. No invented savings, testimonials, logos, scarcity or adoption figures.

**L2 — Positioning and painkillers (pp. 10–20, 31–38, 48–49, 60–72).**
- *Competitive frame* (p. 10): spreadsheets, shared docs, messaging threads, generic task boards (substitutes).
- *Points of parity* (pp. 11–13), table stakes: tasks with due dates, a budget table, a guest list, sharing. *Point of difference:* event-specific coordination across budget ↔ quotes ↔ running order ↔ readiness in one place. *Correlational parity* (p. 12): "specialised" risks reading "complex" → keep first-event setup short.
- *PDB link* (pp. 17–20): Positioning = "one current plan"; Differentiation = the linked quote→budget→readiness behaviour; Brand = calm, organised, lively "production desk".
- *Pain ranking* (p. 48: impact, frequency, severity, feasibility; scores 1–3 are team judgement, **not evidence**):

| Pain | Impact | Freq. | Severity | Feasibility | Rank |
|---|---|---|---|---|---|
| Stale/conflicting plan versions across people | 3 | 3 | 3 | 3 | 1 |
| Budget overruns unseen until late | 3 | 2 | 3 | 3 | 2 |
| Unclear who owns which task / what is due | 2 | 3 | 2 | 3 | 3 |
| Running order not matching what suppliers were told | 2 | 2 | 3 | 3 | 4 |
| Comparing supplier quotes across threads | 2 | 2 | 2 | 3 | 5 |

- *Painkiller rubric* (pp. 61–63; each of 5 dimensions scored **1 only with objective evidence, else 0**; 4/5 or 5/5 = permission to build, ≤3 = pivot): financial impact 0, workflow criticality 0, weekly frequency 0, existing budget line 0, 24-hour regret test 0 → **0/5, all unknown**. By the lecture's rule this is below the build threshold. This is an assigned prototype, so build proceeds, with the explicit note that **commercial validation is unproven** and the rubric must be rescored after interviews. The rubric's B2B/B2C warning (p. 64) is noted: SceneSet serves small teams/individuals (closer to B2C/prosumer); do not assume B2B ACV.

**Five-conversation plan (do not contact anyone; invent no results).** Per L2 pp. 65–71 and L5 p. 70 (past behaviour, open questions):
1. Walk me through the last event you planned — where did the plan live? (workflow storyboard)
2. What workarounds do you use now, and what went wrong with them? (existing alternatives)
3. How long did planning coordination take; what did a mistake cost? (time/cost; Annual Pain Cost = hours/week × cost/hour × 52, p. 66)
4. What made you change a tool/process last time? (switching trigger, L6 pp. 82–86)
5. Would you commit something tangible — a pilot slot, shared real plan, introduction, or prepayment? (L2 p. 65/67; compliments are "polite lies", p. 67)
Record in `docs/QA.md` §Research log (blank until real).

**L3 — Specification-first (pp. 14–16, 25–26, 30–39, 42–46).** Role → Context → Constraints. `PRD.md` and `tasklist.md` precede code. One micro-task at a time: implement → verify → tick → next. Ideas outside scope go to the post-launch backlog (§2.5), not the build. The "7-day" idea is a scoping discipline, not an estimate.

**L4 — Canvases (pp. 36–46, 60–78).** Lean Canvas filled in the taught order (p. 66); the Business Model Canvas would be the later execution tool for a validated model (p. 62) — not produced here.

| # | Block | SceneSet (all **hypotheses**) |
|---|---|---|
| 1 | Customer segments / early adopters | Repeat organisers of small events: pop-up market runners, society committees, small agencies |
| 2 | Problem / existing alternatives | Plan fragmented across spreadsheets, shared docs, chat, generic task boards |
| 3 | UVP / high-level concept | "One current plan for your event team." Concept: a production desk for small events |
| 4 | Solution | Tasks, suppliers+quotes, budget, guests, run-of-show, 2D layout, readiness, print |
| 5 | Channels | Organiser communities, society networks, demo link (unvalidated) |
| 6 | Revenue / costs | Free personal; per-event upgrade; monthly organiser plan. Costs: hosting, DB, founder time (unquantified) |
| 7 | Key metrics | See "Learning measures" below |
| 8 | Unfair advantage | **Not yet established.** A feature list is not a moat (L6 p. 100) |

*Value Proposition Canvas (pp. 36–46).*

| Customer job | Pain | Gain | Pain reliever | Gain creator |
|---|---|---|---|---|
| Keep team aligned on one plan | Conflicting versions | Confidence the plan is current | Single shared saved plan | Readiness checklist |
| Stay within budget | Hidden overruns | Clear remaining budget | Linked quote→budget; over-budget state | Totals that reconcile |
| Run the day smoothly | Unclear order/owners | Calm event day | Run-of-show with assignees, overlap warnings | Print-ready plan |
| Choose suppliers | Quotes scattered | Fast, fair comparison | Side-by-side quote table | Accept → budget in one action |

*Learning measures (observable, no analytics service; manual log in `docs/QA.md`):* time to first usable event plan; planning-flow completion (steps 1–9 of the value loop); repeat event creation; stated vs demonstrated upgrade interest (sandbox clicks are **interest, not payment**).

**L5 — Design Thinking and beachhead (pp. 40–42, 49–52, 57–92).** Double Diamond Discover→Define→Develop→Deliver and Empathise→Define→Ideate→Prototype→Test, iterated (pp. 60, 65). Beachhead: whole usable workflow for one segment before adjacent features (pp. 49–51).
- *Solution-free problem statement* (p. 76 formula): "When an organiser coordinates an event with helpers, they need to know what is decided, owed and due, and they are dissatisfied with spreadsheets and chat threads because information diverges and nothing shows what is at risk."
- *Provisional persona (HYPOTHETICAL — attributes and emotions invented for design, not researched):* "Mina", 27, volunteer organiser of a monthly pop-up market, 4 helpers, plans in a spreadsheet + group chat. Goals: a market that runs on time within budget. Frustrations: last-minute supplier changes; unsure who confirmed what. Emotions: anxious before event day, relieved when the list is complete.
- *Journey (hypothetical) and friction:* Decide event → *friction:* re-creating last time's sheet; Gather quotes → *quotes scattered in chats*; Budget → *totals out of date*; Assign → *helpers unsure of tasks*; Run-of-show → *versions disagree*; Event day → *printing/phone screenshots of stale plan*.
- *HMW (p. 78 rules):* How might we make a small team's event plan quick to set up and trustworthy on the day?
- *Two workflow options sketched (Ideate p. 79–83; Prototype p. 86):*
  - **A — Checklist-first:** tasks and readiness are the spine; budget/suppliers hang off tasks. Importance high, feasibility high, but weak for cost control.
  - **B — Event-desk-first (chosen):** event dashboard as hub with linked views (tasks, quotes→budget, guests, run-of-show, layout, readiness). Importance high, feasibility medium-high; matches the assignment's core workflow [SRC p.26].
- *MoSCoW (assignment items are never downgraded):* **Must** = every item in §2.1. **Should** = keyboard-moveable layout polish, stale-update warning on budget edits. **Could** = drag moving, templates. **Won't (MVP)** = §2.4.

**L6 — Stress tests and Build–Measure–Learn (pp. 49–51, 62–78, 80–117).** Order: desirability → viability → feasibility (p. 81). Functional tests prove the build, **not** demand or willingness to pay.

| Dimension | Riskiest assumption | Evidence now | Smallest useful test | Proposed threshold (hypothesis) | Pass / Pivot / Park |
|---|---|---|---|---|---|
| Desirability | Repeat organisers feel enough pain from scattered plans to switch | None (no interviews) | 5 organiser conversations + prototype walkthrough; ask for a tangible commitment (L6 p. 88) | ≥3 of 5 describe a recent plan failure **and** ≥2 commit time/data/intro/money | Pass: proceed. Pivot: change segment/problem. Park: weak/polite signals (p. 90) |
| Viability | Organisers pay HKD 149/event or 299/month | None | Willingness-to-pay test (§1.3) with defined product profile | ≥2 of 5 state purchase intent ≥4/5 at a price **and** one prepays/pilots | Pass/Pivot (price, payer, cost to serve)/Park (p. 105) |
| Feasibility | Solo founder can deliver full-stack MVP with isolation and security | This build | Phases 1–8 verification gates; clean-setup run | All required MVP checks pass with recorded evidence | Pass/Pivot scope/Park (p. 117) |

*Switching trigger and resistance (pp. 82–86, hypothesis):* trigger — a missed deadline, double-booked supplier or budget overrun on a prior event. Resistance — habit of the existing spreadsheet, effort to re-enter data, fear of losing history. SceneSet response: demo data, short setup, print/export so data is never trapped.

*Build–Measure–Learn:* each phase ends with a demo of the working increment and one line in `docs/QA.md` §Lessons. Retrospective prompts follow L6 p. 51. Mock-based or fake-door tests are labelled as demand signals only (p. 103).

**L7 — Pricing and startup math (pp. 5–36, 40–87).**
- *Three decisions kept separate (p. 5):* **Price level** — Free HKD 0, HKD 149/event, HKD 299/month [ASM]. **Pricing model** (pp. 29–34) — transactional for event upgrade, subscription for the organiser plan (predictable, lower upfront cost, p. 31–32); no consumption or performance pricing. **Strategy** (pp. 35–36) — freemium penetration to build adoption; the lecture notes typically only 1–2% of freemium users convert (p. 36), so conversion assumptions stay low. Cost-plus is avoided (circular logic, p. 9).
- *Why these options:* occasional organisers value one event → per-event; regular organisers amortise value across events → monthly (matches [SRC p.10] repeat-organiser reasoning). Break-even between them in this draft: 299 ÷ 149 ≈ 2.0, i.e. monthly beats per-event for >2 events a month (an *illustrative* arithmetic fact, not evidence of behaviour).
- *WTP test draft (pp. 14–23, 25):* Target product profile (p. 22): "a shared event plan with budget, quotes, schedule and layout for small teams". Price sensitivity questions (p. 16): too cheap to trust / bargain / getting expensive / too expensive. Then purchase probability on 1–5 (pp. 17–19) at 3 price points per plan. Lower bound = price of next-best alternative (free spreadsheets) + incremental benefits − drawbacks (p. 13). Price slightly below exchange value unless WTP is much higher (p. 25).

*Illustrative startup math (product notes only; **all inputs invented**, not a market claim; no in-app dashboard):*

| Input | Value (assumed) |
|---|---|
| Monthly price | HKD 299 |
| Target ARR | HKD 500,000 |
| Monthly churn | 5% (0.05) |
| Lead-to-paying conversion | 1% (0.01), defined as unique visitor who starts a trial → paying subscriber, end to end |
| Monthly contribution margin per subscriber | HKD 250 (= 299 − assumed 49 hosting/fees/support per subscriber) |
| CAC | HKD 300 |
| Fixed costs | HKD 4,000 / month |

| Formula | Result |
|---|---|
| Subscription ARR per subscriber = 299 × 12 | HKD 3,588 |
| Active subscribers needed = target ARR ÷ ARR/subscriber = 500,000 ÷ 3,588 | ≈ 139.4 → **140** |
| MRR at 140 subscribers = 140 × 299 | HKD 41,860; ARR = 41,860 × 12 = HKD 502,320 (**excludes** per-event upgrades, which are shown separately) |
| Lifetime months = 1 ÷ 0.05 (steady churn) | 20 months |
| Contribution LTV = 250 ÷ 0.05 − 300 | HKD 4,700 (margin = price − variable hosting/fees/support; excludes founder time and fixed costs) |
| Replacement customers/month = 140 × 0.05 | 7 |
| Leads/month to **replace** = 7 ÷ 0.01 | 700 (growth needs more) |
| Break-even subscribers = fixed ÷ contribution = 4,000 ÷ 250 | 16 |

Rules: rates are decimals; every function returns "n/a" for zero/invalid denominators; do not over-state precision. **L7 p. 65 typo recalculated:** the slide prints 367 for 16,667 × 2.08%; correct value = 346.67 ≈ **347**, which matches p. 66 and p. 71. Market-size and adoption-share figures in L7 (e.g., 2,286 firms) are lecture illustrations, not SceneSet facts.

### 1.2 Assumption vs evidence register

| Statement | Type |
|---|---|
| Event data is scattered across tools (problem) | From assignment p. 10; **not** independently validated |
| Repeat organisers pay more than one-off hosts | Assignment p. 10; unvalidated |
| Prices HKD 149/event, 299/month | Hypothesis |
| 1% lead conversion, 5% churn | Hypothesis (L7 p. 67 says assume 1% when unsure) |
| Persona "Mina" | Hypothetical |
| Functionality of the build | Will be evidenced by `docs/QA.md` |

---

## 2. Phased scope isolation

### 2.1 MVP requirements (all required; delivered across implementation phases 1–8)

| ID | Requirement | Source |
|---|---|---|
| R01 | Landing page (audience, problem, outcome, Try demo, Create event, product preview, pricing path) | SRC p.27; USER |
| R02 | Sign-up, sign-in, sign-out | SRC p.26 |
| R03 | Password reset incl. completion and expired-link states | SRC p.26; USER |
| R04 | Workspace creation/onboarding with owner/organiser/collaborator roles | SRC p.26 |
| R05 | Member management (add existing registered account, change role, remove), last-owner protection | USER; ASM |
| R06 | Events list with search, create, edit, archive/delete, selection | SRC p.27 |
| R07 | Event dashboard (counts from saved records, direct links) | SRC p.26 |
| R08 | Task board To do / In progress / Done, assignee, due date, priority | SRC p.26–27 |
| R09 | Event notes | SRC p.26 (Notes entity) |
| R10 | Supplier directory | SRC p.26–27 |
| R11 | Event quote comparison, shortlist/accept | SRC p.27 |
| R12 | Budget items, categories, totals, over-budget state, accepted-quote→item link | SRC p.26–27 |
| R13 | Guest list, RSVP status, headcount vs capacity | SRC p.26–27 |
| R14 | Run-of-show schedule with overlap/window warnings | SRC p.26–27 |
| R15 | Venue-layout planning (2D, numeric+keyboard controls, saved) | SRC p.26–27 |
| R16 | Search and filters per view; reset; no-results | SRC p.26 |
| R17 | Readiness checklist (transparent) | SRC p.26 workflow step 9; USER |
| R18 | Print-friendly event summary (authorised route) | SRC p.26 |
| R19 | Fictional demo data: public read-only demo without login; signed-in users can load an isolated editable copy into their own workspace and reset it | SRC p.26; USER (decision 2) |
| R20 | Settings (profile, workspace, privacy, data deletion) | SRC p.27 |
| R21 | Pricing page: Free Personal, Event Upgrade, Organiser monthly | SRC p.27 |
| R22 | Test-only payment sandbox (success/cancel/fail), "No real payment taken" | SRC p.27; USER |
| R23 | Illustrative vendor-referral section, visually separate, no live operations | SRC p.27 |
| R24 | Privacy page + collection notice (PICS) at data entry; account/data deletion path | USER (L3 p.31; SRC p.33 §7) |
| R25 | Accessibility baseline (WCAG 2.2 AA aim, keyboard, focus, contrast, 44px targets) | SRC p.27, p.33 §7 |
| R26 | Responsive: primary desktop; usable at 375/768/1024/1440 | SRC p.27 |
| R27 | Tenant isolation: server checks + RLS across list/read/write/delete/aggregate/export | USER |
| R28 | Money in integer minor units; one currency per event; event-timezone schedule | USER |
| R29 | Organiser acceptance checklist + testing grid | SRC p.27; USER |
| R30 | Concise post-MVP list | SRC p.27 |

### 2.2 Implementation phases

| Phase | Content | Requirements |
|---|---|---|
| 0 | Inspect, specify, plan (this document + `tasklist.md`) | — |
| 1 | Foundation, design system, landing page, shell | R01, R25, R26 |
| 2 | DB, auth, workspace isolation, member management | R02–R05, R27, R28 |
| 3 | Events, dashboard skeleton, tasks, notes | R06–R09, R16 |
| 4 | Suppliers, quotes, budget | R10–R12 |
| 5 | Guests, run of show | R13, R14 |
| 6 | Layout, readiness, print, settings, privacy, demo data | R15, R17–R20, R24 |
| 7 | Pricing, sandbox upgrade, referrals | R21–R23 |
| 8 | Verify, fix, polish, handover | R29, R30 and all |

### 2.3 MoSCoW
Must: all R-IDs. Should: stale-update check on budget/event edits; keyboard layout movement (already Must for R15 alternative). Could: drag movement; template starter events. No assignment requirement is downgraded.

### 2.4 Out of scope for MVP [USER]
Real payments, ticketing, marketplace, vendor onboarding, automated supplier discovery, public RSVP portals, bulk email, calendar integrations, chat, AI planning, complex seating optimisation, CAD, offline sync, native apps, avatars, dark-mode switch, advanced analytics, email-invitation service, realtime co-editing/presence.

### 2.5 Post-launch backlog (ideas only, not built)
Specialist templates (assignment p.10 revenue idea), supplier referrals as real revenue, public RSVP page, email invitations, calendar export (.ics), CSV/PDF export, realtime updates, seat assignment, multi-currency, audit log, team invitations by email, real Stripe test→live billing.

---

## 3. Interface and UI layout

### 3.1 Route map (stable routes; event selection in the URL)

| Route | View | Auth | Req |
|---|---|---|---|
| `/` | Landing | public | R01 |
| `/pricing` | Pricing + referral concept | public | R21, R23 |
| `/privacy` | Privacy page / PICS | public | R24 |
| `/login`, `/signup` | Account | public | R02 |
| `/forgot-password`, `/reset-password` | Recovery | public | R03 |
| `/demo`, `/demo/[view]` | Read-only fictional demo (no login), built by the same rules as the real app from a fixed fictional dataset | public | R19 |
| `/onboarding` | Create a workspace (the first event is created from the events list; the editable sample is loaded from there) | auth | R04 |
| `/w/[ws]/events` | Events list + search | member | R06 |
| `/w/[ws]/events/[ev]` | Dashboard | member | R07 |
| `/w/[ws]/events/[ev]/tasks` | Task board + notes | member | R08, R09 |
| `/w/[ws]/events/[ev]/budget` | Budget | member (edit: owner/organiser) | R12 |
| `/w/[ws]/events/[ev]/suppliers` | Supplier directory + quote comparison | member | R10, R11 |
| `/w/[ws]/events/[ev]/guests` | Guests | member | R13 |
| `/w/[ws]/events/[ev]/schedule` | Run of show | member | R14 |
| `/w/[ws]/events/[ev]/layout` | Venue layout | member | R15 |
| `/w/[ws]/events/[ev]/summary` | Print summary | member | R18 |
| `/w/[ws]/settings` | Workspace, members, plan, privacy, data deletion | member (admin: owner) | R05, R20 |
| `/w/[ws]/upgrade` and `/w/[ws]/upgrade/sandbox` | Plan, limits and test checkout (success/cancel/fail); members see the plan read-only | member (change: owner) | R22 |

Unauthenticated deep links redirect to login then return. Unknown/forbidden event IDs return the same not-found page (no existence disclosure).

### 3.2 Core journeys & states
1. Visitor → Try demo (read-only, no sign-in) → sign up → "Load a sample event" into their own workspace → dashboard.
2. Visitor → Sign up → onboarding → blank event (title, dates, venue) → dashboard with empty-state prompts.
3. Organiser works through tasks → budget → suppliers/quotes → guests → schedule → layout → readiness → print.
Every view defines: loading, empty (invitation to act), no-results (with reset), validation (inline, preserves input), permission-denied (explains role), error/network (retry, data preserved), saving (disabled button, "Saved" only after persistence).

### 3.3 Layout
Desktop sidebar (event nav) + header (workspace/event switcher, event title, view title, primary action). Dense tables and boards. At <1024px sidebar collapses to an accessible disclosure menu; tables and layout canvas scroll within their own container; page has no horizontal overflow. Landing hero value + primary CTA visible within 375×667.

Wireframe — event dashboard (1440px):
```
+--------+--------------------------------------------------------------+
| Sidebar| Workspace ▾ | Event ▾    Dashboard              [+ Add task]  |
| Events |--------------------------------------------------------------|
| Dash   | [Date block]  Title · Venue · Status                          |
| Tasks  |--------------------------------------------------------------|
| Budget | Readiness (checklist)      | Budget summary                    |
| Suppl. | Overdue / upcoming tasks   | Guests: RSVP / capacity           |
| Guests | Run-of-show next 3         | Layout: items placed              |
| Sched. |                                                              |
| Layout |                                                              |
| Summary|                                                              |
+--------+--------------------------------------------------------------+
```

### 3.4 Visual system (one system for marketing and app)

**UI UX Pro Max results (Phase 1, actually run; relevance checked).**
- Query 1 `"event planning desktop workspace" --design-system`: **rejected** — returned wedding/romance pink palette, script fonts and a testimonials-carousel landing pattern (off-target; testimonials conflict with the no-fabricated-proof rule).
- Query 2 (one retry, narrower) `"project management task board dashboard productivity SaaS" --design-system --density 7`: **accepted as direction** — Flat Design style (clean, no heavy shadows, 150–200 ms transitions); teal primary + orange action accent; Plus Jakarta Sans ("SaaS, dashboards, B2B, productivity"); pattern "Product Demo + Features". Its "Pre-Delivery Checklist" (SVG icons not emoji, `cursor-pointer`, visible focus, reduced motion, 375/768/1024/1440) is adopted.
- Targeted: `--domain ux` keyboard/focus → visible focus on every control, tab order = visual order; `--stack nextjs` → App Router, Server Components by default, minimal `'use client'`.
- Not adopted: Bebas Neue/all-caps display (typography guidance in `frontend-design` avoids all-caps labels).
- (Phase 1 only; superseded by the redesign below.) Where results differ from the brief, the brief wins: warm neutral workspace and deep-green primary are kept; search teal/orange informs hue family only. Density dial 7 ≈ standard-dense operational UI.
- Display face for the landing hero is my choice (Bricolage Grotesque), **not** a search result.

**Redesign (supersedes the "Event production desk" concept and the deep-green tokens listed under "Superseded" at the end of this section).** The visual direction is now set by one supplied reference site, `https://sceneset-b3n9h4rl.manus.space/dashboard`, inspected in the built-in browser at 1440 px and on a phone. `docs/design/REFERENCE.md` records what was observed, what was adapted (and why) and what was assumed; screenshots are in `docs/design/`. In short: a warm cream page (`#f7f4ed`), paper cards and sidebar (`#fffefa`) with hairline borders and one very soft shadow, navy ink and primary actions (`#173553`), a coral accent for the small tracked eyebrow above each page title, urgent dates and progress fills, sage and blue and gold tints for tiles and status pills, Inter as the only typeface (tight, heavy headings; tabular figures), 11 px card radius, 8 px buttons, a fixed 248 px sidebar with line icons and a plan card, a 66 px top bar with breadcrumbs, a four-up metric row, a two-column panel grid (about 1.65 : 0.95), a navy summary card for money, and date tiles. Below 821 px the sidebar becomes a drawer opened from the top bar.
- **Where SceneSet deliberately differs (accessibility floors the product commits to):** type is scaled up (UI 14 px, captions 12 px at least) while the hierarchy is kept; secondary text and control borders are darker than the reference's so they meet 4.5 : 1 and 3 : 1; buttons and fields are 44 px high; the focus ring is navy with a coral halo; no "All changes saved" claim; every number comes from saved records.
- **Tokens:** implemented in `src/app/globals.css` and checked by `npm run contrast` (30 text, control and tint pairs, all pass). Shared building blocks: `.panel`, `.metric`, `.pill`, `.date-tile`, `.tile`, `.eyebrow`, `.page-title`, `.row-card`, `.navy-card`; components `AppShell` (sidebar, top bar, drawer), `PageHeader`, `Brand`, `StatusChip`, `Button`, `CueTab` (now the date tile), `Field`.
- **Fonts:** Inter via `next/font` for everything.
- Motion: 150 to 200 ms state changes only (hover lift of 1 px on buttons and linked rows, 2 px nudge on nav rows, drawer slide); `prefers-reduced-motion` honoured; no hover-only controls.
- Illustrations and screenshots: original CSS and SVG only.
- **Rollout (complete):** checkpoint A built the shared tokens, the application frame and the event dashboard; the combined checkpoint B+C applied the same system to every other screen (events, event form, tasks and notes, suppliers and quotes, budget, guests, run of show, venue planner, print summary, settings, plan, test checkout, onboarding, the landing, pricing and privacy pages, sign-in and password pages, the 404 and error pages, and the public demo) and then audited it: phone drawer, keyboard order and focus rings, reduced motion, print output, empty and permission-restricted states, planner at phone and desktop width, responsive widths 375, 768, 1024 and 1440 px, contrast, lint, typecheck and production build, plus a sequential browser regression pass. Evidence and the remaining unverified items are in `docs/QA.md` ("Design redesign") and `docs/design/REFERENCE.md` (sections 5 and 6).

Superseded (kept as history of the first design pass): concept "Event production desk" with a ticket-stub cue tab; deep green `#0B5D4B` on warm neutral `#F3F2EE`, stage-light accent `#FFC23D`; Plus Jakarta Sans for the UI and Bricolage Grotesque for display.

---

## 4. Technical stack and architectural constraints

**Existing code:** none (empty directory) → scaffold new. **Default stack [ASM, per brief]:** Next.js App Router + TypeScript + Tailwind CSS; Supabase PostgreSQL + Supabase Auth via `@supabase/supabase-js` and `@supabase/ssr`; SQL migrations (constraints + RLS); server actions/route handlers for mutations with authorisation; RLS as defence in depth. One package manager (npm), lockfile retained.

Deliberate simplifications of the lecture's illustrative stack (SRC p.33 lists Drizzle/Clerk/Stripe/ImageKit/Gemini): one provider for auth+DB; no ORM; no Stripe; no image storage; no AI API. Supabase JS is a cloud-client SDK, satisfying the pitfall guidance on native ORMs [SRC p.43].

**Architecture:** server components fetch via a per-request Supabase server client (user session → RLS applies). Mutations validated on the server (zod only if already justified; otherwise hand-written checks; decide in Phase 1 per Ponytail). Business rules that need atomicity (accept quote→budget item, last-owner check, demo workspace creation, workspace delete) live in SQL functions called via RPC with `SECURITY INVOKER` where possible; any `SECURITY DEFINER` function sets `search_path` and re-checks membership. No custom auth, event bus, microservices, or generic repository layer.

**Config (names only; never print values):**
- Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (current publishable-key approach; designed to be public and relies on RLS; a legacy `anon` key also works and the old name `NEXT_PUBLIC_SUPABASE_ANON_KEY` is read as a fallback), `NEXT_PUBLIC_SITE_URL`.
- Private: `SUPABASE_SECRET_KEY` (`sb_secret_…`; legacy name `SUPABASE_SERVICE_ROLE_KEY` read as fallback). Used by `scripts/rls-remote-test.mjs`, by the test helpers, and by two server actions: account deletion (phase 6) and the test-mode plan functions (phase 7, because their on/off switch is a server variable). It is never imported by a client component and never `NEXT_PUBLIC_`. Also `PAYMENT_SANDBOX_ENABLED` (see Phase 7 notes for the intended deployment value).
- `.env.local` (git-ignored) holds values; `.env.example` holds placeholders; `.gitignore` covers `.env*` except example.

**Deployment [ASM]:** Vercel-style Next.js host + Supabase cloud project; documented in README (Phase 8). No publishing without founder approval.

**Persistence rule:** localStorage only for harmless UI preferences, never authoritative records.

---

## 5. Database schema and entity design

Conventions: UUID PKs (`gen_random_uuid()`), `created_at`/`updated_at timestamptz`, money as `bigint` minor units (≥0), `char(3)` currency on events, schedule instants as `timestamptz` rendered in `events.timezone` (IANA string). Optimistic concurrency via `updated_at` compare on budget/event edits.

| Table | Key columns | Notes / deletion |
|---|---|---|
| `profiles` | `id` PK = `auth.users.id` (FK cascade), `display_name`, `created_at` | Minimal; no duplicated auth data |
| `workspaces` | `id`, `name`, `plan` (`free`/`organiser`), `created_by` | `plan` = sandbox entitlement; deleting workspace cascades owned children |
| `workspace_members` | `workspace_id` FK cascade, `user_id` FK cascade, `role` (`owner`/`organiser`/`collaborator`), PK (workspace_id, user_id) | ≥1 owner enforced by trigger/function |
| `venues` | `id`, `workspace_id` FK cascade, `name`, `address_note`, `width_cm`, `depth_cm` (>0) | Shared reference: event→venue `ON DELETE SET NULL`/restrict |
| `events` | `id`, `workspace_id` FK cascade, `title`, `type`, `goals`, `starts_at`, `ends_at` (>starts_at), `timezone`, `currency`, `venue_id` FK set null, `capacity` ≥0, `budget_target_minor` ≥0, `status` (`planning`/`confirmed`/`done`), `archived_at`, `event_upgrade` bool | Archive ≠ delete; delete cascades event children |
| `tasks` | `id`, `event_id` FK cascade, `title`, `status` (`todo`/`in_progress`/`done`), `priority`, `due_at`, `assignee_id` (member of same workspace) | Assignee FK to profiles `ON DELETE SET NULL`; same-workspace check via trigger |
| `schedule_entries` | `id`, `event_id` FK cascade, `title`, `starts_at`, `ends_at` (>starts_at), `location`, `owner_id` set null, `notes` | Order: `starts_at, ends_at, id` |
| `suppliers` | `id`, `workspace_id` FK cascade, `name`, `category`, `contact_note`, `notes` | **RESTRICT** if referenced by quotes (history preserved) |
| `quotes` | `id`, `event_id` FK cascade, `supplier_id` FK **restrict**, `amount_minor` ≥0, `scope`, `status` (`requested`/`shortlisted`/`accepted`/`rejected`), `notes` | Supplier and event must share workspace (trigger) |
| `budget_items` | `id`, `event_id` FK cascade, `category`, `name`, `planned_minor`, `committed_minor`, `paid_minor` (all ≥0, `paid ≤ committed`), `quote_id` UNIQUE FK set null | UNIQUE `quote_id` prevents duplicate linking; accept→link via RPC, idempotent |
| `guests` | `id`, `event_id` FK cascade, `name` (fictional), `contact` optional, `group_name`, `party_size` ≥1, `rsvp` (`invited`/`confirmed`/`tentative`/`declined`), `notes` | Attending headcount = sum(party_size) where confirmed |
| `layout_items` | `id`, `event_id` FK cascade, `kind`, `label`, `x_cm`, `y_cm`, `w_cm`, `h_cm`, `rotation` | CHECK in-bounds enforced against venue dimensions in RPC/trigger; ≥0 sizes |
| `notes` | `id`, `event_id` FK cascade, `author_id` set null, `body`, timestamps | Collaborator edits only own |
| `entitlement_events` | `id`, `workspace_id`, `plan`, `outcome`, `idempotency_key` UNIQUE, `created_at` | Sandbox log; no card data |

**Money & totals (per event, derived from rows, no stored duplicates):**
- Planned total = Σ planned. Actual/committed total = Σ committed. Paid total = Σ paid.
- Outstanding = committed − paid.
- Remaining against commitment = budget target − committed (negative ⇒ over budget).
- Variance = committed − planned (positive ⇒ spending above plan).
- **Quote → budget (phase 4, migration 005):** `accept_quote(quote, into_item?)` is the only way a quote becomes `accepted`. It creates one budget line (name and category from the supplier; planned = committed = quote amount; paid 0) or fills an existing unlinked line on the same event, **replacing** that line's committed amount with the quote amount. Repeating it returns the same line and changes nothing, including under concurrent clicks (quote row locked; `budget_items.quote_id` UNIQUE). While accepted, the quote's status/amount/supplier and the line's committed amount are locked; `reopen_quote()` unlinks but keeps the line; deleting a linked line returns its quote to `shortlisted`. Totals sum budget lines only, never quotes, so nothing is counted twice. Supplier and budget categories share one list (`BUDGET_CATEGORIES`). With no budget target (0), "remaining" is shown as "Not set" and spending is never called over budget.
- **Guests (phase 5):** a guest *record* may stand for a party; records and people (sum of `party_size`) are always shown separately. Attending headcount = people on `confirmed` records only; capacity warnings use that headcount ("over" when above capacity; "could exceed" when confirmed + tentative people would exceed it). Filters narrow the table only; the summary always covers all guests. No invitations are sent from SceneSet.
- **Run of show (phase 5):** entries are ordered by start, end, id; times are entered and shown in the event's timezone (stored as UTC instants); `end > start` is required, so an overnight entry uses the next day's date. Back-to-back is not an overlap. A plain overlap is informational ("runs in parallel"); the same person on overlapping entries and entries outside the event window are warnings. Nothing blocks saving.
- Zero/empty budgets show 0 and no percentage (no divide-by-zero).

**Role matrix [ASM, changeable]**

| Capability | Owner | Organiser | Collaborator |
|---|---|---|---|
| Read all workspace event data | ✔ | ✔ | ✔ |
| Create/edit/archive/delete events | ✔ | ✔ (delete: ✔) | ✘ |
| Tasks: create/edit/assign/delete | ✔ | ✔ | status of **own assigned** tasks only |
| Budget/suppliers/quotes edit | ✔ | ✔ | ✘ |
| Guests, schedule, layout edit | ✔ | ✔ | ✘ |
| Notes | ✔ | ✔ | add/edit **own** |
| Member add/role/remove, ownership transfer | ✔ | ✘ | ✘ |
| Workspace settings, plan/upgrade, delete workspace | ✔ | ✘ | ✘ |
Self-promotion and removing/demoting the last owner are rejected in SQL. Members are added by **existing registered account email** (no email-invitation service in MVP).

**Tenant isolation / RLS.** RLS enabled on every table. Helper `is_member(workspace_id)`/`has_role(workspace_id, roles[])`. Policies: select for members; writes per matrix; event-child tables resolve workspace via event. Cross-workspace linked IDs (assignee, supplier, venue, quote) blocked by triggers/RPC. Aggregates and print/summary queries run as the user (RLS applies); no service key in app request paths. **Demo:** the public `/demo` is read-only and renders a fixed fictional dataset with no database write and no session. A signed-in user can run a "Load demo data" RPC that copies a fictional template into **their own** workspace (isolated by RLS like any workspace); "Reset demo" recreates only that copy. The demo never uses an admin key client-side. Anonymous sign-ins are deferred (founder decision 2).

**Privacy & deletion.** Plain-language `/privacy`; collection notice beside forms collecting personal data (guest names/contacts: advise fictional/minimal); consent timestamp stored **only** where consent is requested (none planned), distinct from notice acknowledgement. Account deletion: blocked while user is sole owner of a workspace with other members until ownership is transferred or workspace deleted; otherwise deletes profile and memberships; authored notes/tasks set null. No analytics/advertising cookies; only essential auth session cookies explained. Retention: demo workspaces purged after a documented period [ASM, e.g., 7 days]. Statement: privacy design review items (GDPR Art. 17, HK PDPO) are design requirements, **not** legal certification.

---

## 6. Third-party API and payment boundaries

- **Supabase Auth (phase 2 implementation):** email+password sign-up, sign-in, sign-out, reset-by-email. Email confirmation stays **ON**; anonymous sign-ins stay **OFF** (founder decision). Sessions via `@supabase/ssr` cookies; `src/proxy.ts` is the only place tokens are refreshed and gates `/app`, `/onboarding`, `/w/*`; pages re-verify with `getClaims()`. Emailed links land on `/auth/confirm` (accepts `token_hash`+`type` from custom templates and PKCE `code` from default templates); only same-site relative `next` paths are honoured. Sign-up and reset show the same message whether or not an account exists. **Built-in email restrictions (documented in README):** development only; delivers only to project-team addresses; about 2 messages/hour; no delivery guarantee; custom SMTP is required before real users.
- **Server operations:** create workspace, create demo, add/change/remove member, event CRUD, task/budget/etc. CRUD, accept-quote-link, layout save, sandbox upgrade, account/workspace deletion. Each: authenticate session → authorise role → validate input → perform → revalidate cache.
- **Payment sandbox [ASM], as built in Phase 7:** local simulation, **no card data**, no money, no Stripe or other provider, no new dependency. Flow: workspace owner opens Plan (`/w/[ws]/upgrade`), picks a known plan id (`event` with one of the workspace's events, or `organiser`), reaches `/w/[ws]/upgrade/sandbox`, and chooses Simulate success, cancellation or failure. That page has only hidden fields and a one-time request key. The server action re-authenticates, requires `PAYMENT_SANDBOX_ENABLED=true` (shipped as `false`), validates the plan, outcome, event and key, then calls the database function `sandbox_checkout` with the server's secret key, passing the verified user as `actor`. Migration 008 makes the function executable only by that key, so a signed-in user cannot call it through the public API to get around the switch (migration 007 had left that open; it was found and closed in Phase 7). The function re-checks that the actor owns that workspace and that the event belongs to it. Only a successful outcome changes `workspaces.plan` or `events.event_upgrade`, which clients cannot write directly. Cancel and failure write a log row (`entitlement_events`) and grant nothing. The request key is unique, so repeating a request replays the first outcome and cannot duplicate anything; a fresh key for something already covered is refused. The redirect after a checkout carries a fixed result key only; the plan shown is always read back from the database, so a success URL grants nothing. The page always says "Test mode — No real payment taken". If a real provider is ever added: test mode first, server-held secrets, signed webhook verification, amount and plan verification, idempotent grants, never trust a success URL.
- **Entitlement matrix [ASM], as built in Phase 7 (test mode):** *Free Personal* HKD 0: every MVP feature, 1 active event, 3 members (the owner plus 2 more). *Event Upgrade* HKD 149 per event, one-off: the chosen event prints without the SceneSet footer, and the workspace allows up to 10 members while any of its events is upgraded; the active-event limit does not change. *Organiser* HKD 299 per month: unlimited active events and members, and prints without the footer. Sample (demo) events and archived events never count toward the event limit. **Required functionality remains demonstrable on Free**: no feature is locked, only the counts above. The limits are checked by the database (migration 007) as well as the app. No metering, tax, invoicing, coupons or proration; no recurring billing exists, so "monthly" is a label and an owner ends the test Organiser plan by hand. Prices are unvalidated hypotheses.
- **Vendor referrals:** static, labelled "Illustrative — not a live marketplace", on `/pricing` below the plans; no commission logic.

---

## 7. Quality, accessibility, privacy and security

**Completion criteria.** Required features R01–R30 verified with evidence in `docs/QA.md`; build/type/lint pass; automated checks for money totals, time/overnight handling, permissions, tenant isolation, layout bounds; end-to-end organiser journey and access-denial tests; unrun/blocked checks stay unchecked.

**Verification gates (L3 p.39; SRC p.35):** Build gate (`npm run build`), Local server gate (dev server, no console errors), Database gate (migrations apply to verified dev target; direct SQL denial tests), Visual audit (375/768/1024/1440). Gates are pass/fail with recorded commands and outcomes; a failing gate leaves the task unchecked.

**Accessibility.** WCAG 2.2 AA aim: landmarks, headings, labels, table headers, status text not colour-only, visible focus (`outline: 2px solid`), ≥4.5:1 text contrast (measured, not assumed), 44×44px targets where feasible, usable dialogs with focus restore + Escape, keyboard alternative to dragging, reduced motion.

**Security.** No secrets in tracked files, logs or screenshots; RLS on all tables; server-side authorisation not only hidden controls; input validation at boundaries; duplicate-submit protection; confirm destructive actions; "Saved" only after persistence; no `NEXT_PUBLIC_` private values; fictional demo content only.

**Data integrity.** Constraints in SQL (non-negative, `paid ≤ committed`, `ends_at > starts_at`, unique quote link); stale-update check on events/budget; cascade only for owned children.

**Known limitations (to be kept current).** Not legally certified; no realtime collaboration (refresh/revalidate only — UI must not claim "live"); sandbox ≠ billing; demand unvalidated; image-only slides not inspected; UI UX Pro Max not run; Phase 2+ require Supabase credentials.

---

## 8. Traceability (source → requirement → route/entity → phase → verification)

| Source (PDF page) | Req | Route / entity | Phase | Verification |
|---|---|---|---|---|
| SRC p.26 workflow step 1 | R02–R04 | `/signup`, `/onboarding`, workspaces | 2 | Sign-up/in/out/reset E2E; RLS denial test |
| SRC p.26 sign-up/in/reset | R02, R03 | auth | 2 | Reset-link complete + expired-link case |
| SRC p.26 roles | R04, R05 | `workspace_members` | 2 | Role escalation & last-owner SQL tests |
| SRC p.26 steps 2–3, events | R06 | `/events`, `events` | 3 | CRUD + search + persistence after re-login |
| SRC p.26 dashboard | R07 | dashboard | 3→6 | Counts match records; no stale totals |
| SRC p.26 step 4, task board | R08 | `tasks` | 3 | Move status, collaborator limits |
| Notes entity p.26 | R09 | `notes` | 3 | Own-note permission test |
| SRC p.26 step 5, suppliers | R10, R11 | `suppliers`, `quotes` | 4 | Compare ≥2 quotes; restrict delete |
| SRC p.26 step 6, budget | R12 | `budget_items` | 4 | Totals; link once; zero/over-budget cases |
| SRC p.26 step 7, guests | R13 | `guests` | 5 | RSVP counts vs capacity |
| SRC p.26 step 8, schedule | R14 | `schedule_entries` | 5 | Overnight + invalid time + overlap warning |
| SRC p.26 layout | R15 | `layout_items`, `venues` | 6 | Bounds, keyboard, reload coordinates |
| SRC p.26 search & filters | R16 | all lists | 3–5 | Filters don't change totals; reset |
| SRC p.26 step 9, readiness | R17 | dashboard/summary | 6 | Empty ≠ 100%; denominator documented |
| SRC p.26 print summary | R18 | `/summary` | 6 | Print preview, no clipping, authz |
| SRC p.26 demo data | R19 | `/demo` | 6 | Isolated; reset only affects demo |
| SRC p.27 pages | R01, R06–R15, R20, R21 | route map §3.1 | 1–7 | Route audit |
| SRC p.27 design reqs | R25, R26 | UI system | 1, 8 | Contrast + 4 viewports + keyboard |
| SRC p.27 pricing, test payment | R21, R22 | `/pricing`, `/upgrade` | 7 | Success/cancel/fail/tamper tests |
| SRC p.27 vendor referral | R23 | `/pricing` section | 7 | Visual separation; no operations |
| SRC p.27 deliverables | R19, R29, R30 | README, `docs/QA.md` | 8 | Checklist present, unfilled grid |
| SRC pp.33 §7, L3 p.31 | R24, R25 | `/privacy`, settings | 6 | PICS at data entry; deletion path test |
| USER money/time | R28 | schema, formatters | 2, 4, 5 | Unit checks (rounding, timezone) |
| USER isolation | R27 | RLS, RPC | 2→8 | Direct SQL + route cross-tenant tests |
| L7 pp.55–71 | notes only | `PRD.md §1` | 0 | Formula recalculated (347) |


## Phase 6 implementation decisions

- **Readiness (R17).** Eleven equally weighted checks: venue chosen, budget set up, within budget, tasks planned, nothing overdue, supplier quotes decided, guest list started, attendance within capacity, running order drafted, no same-person clashes, venue layout saved. Percentage is checks passed divided by 11. A check that needs data fails until the data exists, so an empty event scores 0% and 100% needs every check. It is a planning aid, not a safety, legal or compliance certification, and the page says so.
- **Layout (R15).** Objects are stored in centimetres inside the venue rectangle. The browser edits a draft and saves it in one transaction through the `save_layout` function, which refuses a stale item, a role without edit rights, or an object outside the venue. A venue cannot be made smaller than the objects placed on it, and an event cannot be moved to a venue its layout does not fit.
- **Demo (R19).** `/demo` is a fixed fictional dataset passed through the same `buildPlan` rules as the real app, with no login and no writes. A signed-in owner or organiser can load or reset one editable sample event in their own workspace. Reset deletes only rows flagged `demo` in that workspace. There is no automatic purge of sample data; it is removed by resetting, deleting the event, or deleting the workspace.
- **Deletion (R24).** A workspace is deleted by an owner after typing its name. An account is deleted after typing the account email. Deletion is blocked while the user is the only owner of a workspace that has other members; they must transfer ownership or delete the workspace first. Workspaces where the user is the only member are deleted with the account. Records in shared workspaces stay, with the author reference cleared. Account deletion uses the server-only secret key after all checks pass.
- **Print (R18).** The summary route is the printable plan. Navigation and controls are hidden in print, tables wrap, and sections avoid splitting rows. This is browser print only; there is no PDF export feature.

## Phase 7 implementation notes

- Plans, limits and wording live in `src/lib/entitlements.ts`; the pricing page and the Plan page both print from it, and `tests/phase7.test.mjs` checks the numbers against this document.
- Migration `20261026000008_sandbox_server_only.sql` replaces the two sandbox functions with server-only versions that take the verified user as `actor`.
- Intended `PAYMENT_SANDBOX_ENABLED`: it ships as `false`. A deployment used to demonstrate the product (the coursework demo) sets `true` together with `SUPABASE_SECRET_KEY`, because the sandbox only simulates and can never take money. Any deployment that real people could mistake for a paid service keeps it `false`: plan pages then say the checkout is switched off, every checkout and end-plan request is refused, and nothing in the database changes. With `false` or without the secret key the free limits still apply.
- Migration `20261026000007_sandbox_entitlements.sql` adds `plan_limits`, the event and member limit triggers (error code `53400`), `sandbox_checkout` and `sandbox_end_organiser`. The existing `workspaces.plan`, `events.event_upgrade` and `entitlement_events` from migrations 001, 002 and 004 are reused.
- `plan_status` was never created and is not needed: with no recurring billing there is no subscription state beyond the plan value.
- Vendor referrals are static, fictional and labelled on `/pricing`; they contain no links, forms or commission logic.
- Known limits: the checkout log is written for owners only and has no refund or dispute concept; ending the Organiser plan is a manual owner action; if a workspace with more members than the free limit is returned to free, nobody is removed (the limit applies to new members only).

---

## 9. Implemented state at handover (Phase 8)

This section records what was actually built, where it differs from the plan above, and where the evidence is. The ordered evidence per requirement is the table in `docs/QA.md` ("Requirement-to-evidence summary"); an ID listed in this document is not proof that a feature works.

**Deviations from the original plan (all deliberate and recorded in the phase notes above)**
- The demo is read-only with no sign-in; the editable copy is "Load a sample event" in a signed-in workspace (founder decision 2). Anonymous sign-ins were not built.
- Member management adds **existing registered accounts** by email; there is no email-invitation service.
- The test-mode plan functions run with the server's secret key (migration 008) because their on/off switch (`PAYMENT_SANDBOX_ENABLED`) is a server variable the database cannot read. Signed-in users cannot call them.
- Event Upgrade raises the workspace member limit to 10 (it is one-off per event); it does not raise the active-event limit. Organiser removes both limits. The printed summary drops its footer for an upgraded event or an Organiser workspace.
- The temporary "Prototype build" notice and the "Preview, not the working app" demo banner were removed. The permanent disclosures remain: the site footer, the pricing note, the demo banner ("Read-only demo… fictional"), the checkout banner ("Test mode — No real payment taken"), and the printed footer.
- `/dev/kit` (a developer component page) stays in the repository but returns 404 in production builds; `npm run smoke` checks that against any running site.
- Added in Phase 8 without changing any feature: a plain error page and a loading state, basic security headers, and the read-only `npm run smoke` script.

**Configuration for a deployment:** see `README.md` sections 2 and 8 (environment variables, auth redirect URLs, the sandbox setting, smoke-test and availability checklists). Nothing has been deployed.

**Known limitations (current):** not legally certified or reviewed; no realtime collaboration (pages refresh on navigation; the UI never claims "live"); the sandbox is not billing; demand and prices are unvalidated; limits apply to new events and members only; no automatic clean-up of old sample or test data; typed text is lost when a save fails because the connection dropped (the failure page says the save may not have happened and nothing is reported as saved); built-in Supabase email is development-only and rate-limited; real-inbox checks (P2.13, P2.15, P2.16) are deferred; screen-reader and real-device testing were not done; only Chromium was used for browser tests; image-only slides in the lecture material were not inspected.
