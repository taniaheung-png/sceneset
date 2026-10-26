# Product

<!-- impeccable:product-schema 1 -->

> Source note: no interview was held. The founder told the design pass to reuse the answers already in `PRD.md`, so every fact below is taken from `PRD.md` (sections 1 to 7 and 9) and the working app, and nothing is invented. Visual direction is deliberately absent: for this redesign it is set by the supplied reference site, not by this file.

## Platform

web

## Users
Small event teams: a student-society or community organiser planning one event at a time, usually with one or two helpers (organiser and collaborator roles) and a budget they must not overrun. They work mostly on a desktop browser, sometimes checking from a phone. The job: keep tasks, suppliers and quotes, budget, guests, running order and venue layout in one current plan, see what is still open, and print one plan for the team.

## Product Purpose
SceneSet is a desktop-first event-planning workspace. One shared plan replaces scattered spreadsheets, chats and documents. Success: an organiser can take an event from first idea to a printed, ready-to-run plan without losing track of money, people or time, and can trust that what they see is saved.

## Positioning
Event-specific coordination in one place: an accepted supplier quote becomes exactly one budget line, guest headcount is compared with venue capacity, the running order handles events past midnight, and a plain readiness checklist shows what is left. Not a generic task tool and not a marketplace.

## Operating Context
Workspaces contain events; each event has tasks and notes, suppliers and quotes, budget lines, guests and RSVPs, a timed running order and a scaled 2D venue layout. Roles: owner, organiser, collaborator. A read-only fictional demo needs no sign-in; signed-in owners can load an editable fictional sample. A labelled test-mode plan checkout simulates upgrades (no real payment). Printing the event summary is a core ritual.

## Capabilities and Constraints
Built and verified (see `docs/QA.md`): accounts and roles, events, task board, notes, suppliers and quotes, budget, guests, running order, venue layout, readiness, printable summary, settings, privacy and deletion, pricing, sandbox plans. Must keep: tenant isolation and role rules, money in integer minor units, event timezones, stale-edit protection, keyboard alternatives for the layout planner, print output. Prices (HKD 149 per event, HKD 299 per month) are unvalidated hypotheses and must stay labelled. Payments are a simulation and must say so. Demo data is fictional and must say so. Real-inbox email checks and deployment checks are deferred.

## Brand Commitments
Name: SceneSet. Plain, kind, specific voice; controls name their action; errors say what happened and what to do. Honest labels are part of the brand: "fictional", "provisional", "test mode, no real payment taken".

## Evidence on Hand
Working application and data model; fictional sample event (Harbour Night Market); `docs/QA.md` verification record; `PRD.md`. No real customers, testimonials or metrics exist and none may be invented.

## Product Principles
1. The plan is the product: every number on screen comes from saved records.
2. Say what is true: label demo, provisional and simulated things where they appear.
3. Efficient first: operational screens stay dense, readable and keyboard-friendly.
4. Nothing is lost silently: saving, failing and permission limits are always visible.
5. Small and finished beats clever: reuse what exists.

## Accessibility & Inclusion
Aim at WCAG 2.2 AA: text contrast 4.5:1, visible focus, 44 px targets, keyboard operation of every control (including the layout planner), no colour-only status, reduced-motion respected, usable at 375, 768, 1024 and 1440 px.
