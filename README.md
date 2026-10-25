# SceneSet

Event planning workspace (prototype, coursework). **Status: implementation phase 1 of 8** — public pages, design system and a static, read-only demo shell. Sign-in and planning tools are not built yet. See `PRD.md` (spec), `tasklist.md` (progress) and `docs/QA.md` (evidence).

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Other checks: `npm run lint`, `npm run typecheck`, `npm run contrast`, `npm run build`.

Phase 1 needs no environment variables. Copy `.env.example` to `.env.local` when Supabase is connected (phase 2). Never commit `.env.local`.

The full setup, migration, demo and deployment guide is written at the final phase (task P8.10).
