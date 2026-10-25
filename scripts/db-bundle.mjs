// Concatenates supabase/migrations/*.sql (in order) into supabase/_bundle.sql so it can be pasted into
// the Supabase SQL Editor in one go. The bundle is git-ignored.
//
//   npm run db:bundle              all migrations (fresh project only)
//   npm run db:bundle -- 5         only migrations numbered 5 and above (to add new ones to an existing project)
//
// The migrations are not idempotent: never run one twice on the same project.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const from = Number(process.argv[2] ?? 1);
const num = (f) => Number(/^\d{8}0*(\d+)_/.exec(f)?.[1] ?? 0);
const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql") && num(f) >= from).sort();
const out = files.map((f) => `-- ===== ${f} =====\n${readFileSync(new URL(f, dir), "utf8")}`).join("\n");
writeFileSync(new URL("../supabase/_bundle.sql", import.meta.url), out);
console.log(`Wrote supabase/_bundle.sql from ${files.length} migration(s): ${files.join(", ")}`);
