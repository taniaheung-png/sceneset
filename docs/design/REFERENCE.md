# Design reference and rules

The visual direction of the app is set by one supplied reference site (the founder's brief for this redesign):
`https://sceneset-b3n9h4rl.manus.space/dashboard` (a prototype built with Manus). It took precedence over the earlier deep-green "production desk" look wherever they differed. This file separates what was **observed** on the reference from what was **adapted or assumed** in SceneSet. Screenshots are in `docs/design/reference/` (the reference at 1440 px was captured through an emulated viewport and is stored at 800 px wide; the 375 px capture is full size), the app before the redesign is in `docs/design/before/`, and the app after is in `docs/design/after/` with side-by-side images `docs/design/compare-*.png`.

Pages visited on the reference: Overview (`/dashboard`), Events, Tasks, Budget, Suppliers, Guests, Schedule, and the phone layout of Overview. Not reached or not inspected: the modal forms (their CSS was read, not rendered), the phone navigation drawer (its CSS was read; the click did not open it in the capture), any state other than the sample data.

## 1. Observed (read from the reference's computed styles and stylesheet)

**Frame.** Fixed left sidebar 248 px wide, paper background, 1 px hairline on the right, padding 27/17/17. Top bar 66 px high with a bottom hairline and a translucent paper fill: breadcrumb at the left ("Workspace / **Overview**"), a status line with a green dot and a coral-tinted round avatar at the right. Content column is centred, at most 1210 px wide, padding 34 px 42 px (28 px at 1120 px and below, 22 px at 820 px, 15 px at 640 px). Below 821 px the sidebar becomes a 245 px drawer with a scrim, opened from a menu button in the top bar.

**Sidebar.** Brand block (42 px navy mark, two-tone wordmark "scene" navy and "set" coral, tiny tracked tagline "EVENT WORKSPACE"); a tracked caps label "WORKSPACE"; seven navigation rows (Overview, Events, Tasks, Budget, Suppliers, Guests, Schedule) each 43 px high with an 18 px line icon, 12 px gap, 9 px radius; the current row has a pale blue-grey fill, navy bold text; hover nudges the row 2 px right; small rounded count badges on Events (neutral) and Tasks (coral). At the bottom: a bordered "tip" card, then a profile row with a round avatar, name, role line and a "..." button, above a hairline.

**Colour.** Page `#f7f4ed` (cream); cards and sidebar `#fffefa` (paper); alternate `#fbf9f3`; ink `#1c2d3d`; navy `#173553` (headings, primary buttons, big numbers) and `#254867` (hover); hairline `#e9e5db`; coral `#df8978` (fills) and `#bb6353` (text); coral tint `#f7e7e1`; sage `#5e826e` with tint `#e6eee7`; blue tint `#e9eff3`; gold tint `#f4eddb`. A single soft shadow `0 4px 14px rgba(34,50,63,.024)` on cards.

**Type.** One family, Inter. Heading 1: 31 px, weight 650, tracking -1 px, line-height 1.1, navy. Eyebrow above it: 9 px, weight 750, +1.55 px tracking, uppercase, coral text. Intro line 11.5 px grey. Panel titles 12 px weight 700. Metric numbers 25 px weight 650, tracking -0.9 px. Most body, caption and badge text is 8 to 10.5 px; navigation 12.5 px.

**Components.** Cards 11 px radius, 1 px hairline, 16 to 17 px padding; inner rows 9 px radius with a lighter hairline; pill status badges 20 px radius, 8 px text, soft tints (planning blue, confirmed sage, draft grey, in progress coral); date tiles 43 x 48 px, 7 px radius, blue tint, day 17 px weight 720 over a tiny uppercase month (every third tile coral); icon tiles 27 px, 8 px radius, tinted; metric cards in a row of four (13 px gap) with a faint quarter-circle outline in the bottom-right corner; one navy summary card (planned spend, large number, thin coral progress bar); primary button navy, 8 px radius, soft navy shadow, lifts 1 px on hover; secondary button paper with a hairline; danger button tinted; checkboxes 15 px with 5 px radius; table headers are a pale rounded strip with tiny tracked caps; inputs 36 px high, 7 px radius, hairline border; modal 13 px radius with a dim backdrop; toast bottom-right; reduced-motion media query present.

**Composition.** Page heading = eyebrow, title, intro on the left and the primary action on the right, bottom-aligned. Then a four-up metric row, then a two-column grid (about 1.65 : 0.95) of panels with a title, a small grey caption and a text link ("All events", "See tasks") at the right of the header. Copy is gentle and specific ("A good plan starts here.", "The little things", "The numbers, gently.").

## 2. Adapted for SceneSet (deliberate differences, with the reason)

| Reference | SceneSet | Why |
|---|---|---|
| Type mostly 8 to 10.5 px | Same hierarchy, scaled up: UI text 14 px, captions and badges 12 px (floor), navigation 14 px, h1 up to 32 px, metric numbers up to 28 px | The reference's smallest sizes are unreadable for many users and below the product's accessibility floor |
| Grey captions about 2.7 to 3.3 : 1 | Secondary text `#5a6770` (5.3 : 1 on paper) | The product commits to 4.5 : 1 text contrast; hue family kept |
| Hairline-only input borders (about 1.2 : 1) | Input and secondary-button borders `#858a85` (3.2 : 1) | Non-text contrast 3 : 1; hairlines kept for cards and dividers |
| Buttons 38 px, controls 35 to 36 px | 44 px minimum | The product commits to 44 px touch targets |
| Coral focus ring | Navy ring with a soft coral halo | A coral ring on cream is about 2.2 : 1 |
| "All changes saved" status in the top bar | Not shown | It would be a claim the app cannot make for every action; saving is reported per action |
| Overview is a workspace-level page; sidebar lists workspace pages | Our dashboard is per event. The sidebar has a workspace group (Events, Plan, Settings) and, inside an event, a "This event" group (Dashboard, Tasks and notes, Suppliers and quotes, Budget, Guests, Run of show, Venue layout). Edit event and Print summary are buttons in the event header | Routes are unchanged and the app is event-centred; no new workspace overview route was added |
| Static example numbers | Every number comes from saved records (or the fictional demo data in the public demo) | Product truth |
| Count badges in the sidebar | Not added yet | Needs extra queries per page load; revisit if wanted |
| Sidebar tip card | Plan card (current plan and a link to Plan) | A real, useful fact in the same place |
| Logo mark | SceneSet's own mark (navy tile, two bars and a coral dot) in the reference's style | The reference's mark is its own identity |
| Eyebrow above the page title | Kept | It is part of the reference's visual signature; the impeccable craft floor lists eyebrows as a default to avoid, and the founder's reference overrides that default |

## 3. Assumptions (not observed, so not claimed)

- Pages the reference does not have (settings, pricing, authentication, sandbox checkout, venue planner, readiness, print summary, empty, error and permission states) are adapted from the same tokens and components; they were not copied from anything.
- Dark mode, hover states other than those in the CSS, and the reference's behaviour at widths between the captured ones were not checked.

## 4. Tokens (as built in `src/app/globals.css`)

Colour: `--paper #f7f4ed`, `--surface #fffefa`, `--sunken #f1efe8`, `--rule #e9e5db`, `--ink #1c2d3d`, `--ink-2 #5a6770`, `--control #858a85`, `--navy/--primary #173553`, `--primary-hover #254867`, `--primary-tint #eaf0f3`, `--coral #df8978`, `--coral-dark #a54e40`, `--coral-soft #f7e7e1`, `--sage #5e826e`, `--sage-soft #e6eee7`, `--blue-soft #e9eff3`, `--gold-soft #f4eddb`; status colours are tints of the same family and are checked by `npm run contrast` (30 pairs).
Shape: card 11 px, row 9 px, button 8 px, field 7 px, pill 999 px. Shadow: `0 4px 14px rgb(34 50 63 / 0.03)`. Layout: sidebar 15.5 rem (248 px), top bar 66 px, content 1210 px.
Type: Inter (variable). h1 `clamp(26px, 2.5vw, 32px)` weight 650, tracking -0.03em; panel title 15 px weight 700; UI text 14 px; caption 12 px; eyebrow 11.5 px caps +0.14em; metric `clamp(24px, 2vw, 28px)` weight 650.
Shared pieces: `.panel`, `.panel-head/title/cap/body`, `.eyebrow`, `.page-title`, `.page-intro`, `.metric*`, `.tile*`, `.pill*`, `.date-tile`, `.row-card`, `.navy-card` (CSS); `AppShell`, `PageHeader`, `Brand`, `StatusChip`, `Button`, `CueTab` (date tile), `Field` (components).
