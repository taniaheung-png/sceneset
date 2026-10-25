// Concatenates supabase/migrations/*.sql (in order) into supabase/_bundle.sql so it can be pasted into
// the Supabase SQL Editor in one go. The bundle is git-ignored. Do NOT run it twice on the same project:
// the migrations are not idempotent (see README for how to reset a development project).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const out = files.map((f) => `-- ===== ${f} =====\n${readFileSync(new URL(f, dir), "utf8")}`).join("\n");
writeFileSync(new URL("../supabase/_bundle.sql", import.meta.url), out);
console.log(`Wrote supabase/_bundle.sql from ${files.length} migrations (${out.length} bytes).`);
