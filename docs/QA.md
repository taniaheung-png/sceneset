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

**Not checked in Phase 1:** screen-reader behaviour; real-device touch; a Windows high-contrast mode; any deployed site. `npm test` has no tests yet (first tests arrive in Phase 2 with money/time helpers).

**Demo status:** `/demo` is a static preview with fictional data. It saves nothing and is not the authenticated product.

**Blocked:** Phase 2 database/auth gates need a Supabase development project. Not started.

## Lessons / unresolved assumptions (Build–Measure–Learn)
- Phase 1 lesson: UI UX Pro Max's first, broad query returned an off-target (wedding) result; a narrower product-type query was needed. Treat the tool as input, not authority.
- Unresolved: all desirability/viability assumptions in `PRD.md` §1.1 remain untested.

## Research log (organiser conversations)
*Empty. Record only real conversations here; none have been held.*

## Human testing grid (L5 testing grid) — fill in during sessions
| What went well | Needs improvement | Questions | Ideas |
|---|---|---|---|
|  |  |  |  |
