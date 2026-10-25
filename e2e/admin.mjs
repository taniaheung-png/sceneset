// Test-only helper (needs `node --env-file=.env.local`). The plan limits are tested in e2e/phase7.mjs; the planning-feature
// suites create several events in one workspace, so they mark their disposable workspace as Organiser first.
import { createClient } from "@supabase/supabase-js";

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

export async function grantOrganiser(ws) {
  const { error } = await admin().from("workspaces").update({ plan: "organiser" }).eq("id", ws);
  if (error) throw new Error(`could not set the test workspace plan: ${error.message}`);
}
