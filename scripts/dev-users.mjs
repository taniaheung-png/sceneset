// Creates / removes disposable, pre-confirmed test accounts in the DEVELOPMENT project so you can test
// roles in the browser without sending confirmation emails (the built-in email service only allows ~2/hour).
// Email confirmation stays ON for the project; these users are confirmed through the admin API only.
//
//   RLS_TEST_CONFIRM=dev-project npm run dev:users -- create     (prints emails + one shared password)
//   RLS_TEST_CONFIRM=dev-project npm run dev:users -- delete     (removes them and their workspaces)
//
// Only addresses matching dev-<role>@example.test are ever touched. Real accounts are never modified.
import { createClient } from "@supabase/supabase-js";

if (process.env.RLS_TEST_CONFIRM !== "dev-project") {
  console.error("Refusing to run. Set RLS_TEST_CONFIRM=dev-project to confirm this is a development project.");
  process.exit(2);
}
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const ROLES = ["owner", "organiser", "collaborator", "outsider"];
const emailOf = (r) => `dev-${r}@example.test`;
const cmd = process.argv[2];

async function existing() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.filter((u) => ROLES.some((r) => u.email === emailOf(r)));
}

if (cmd === "create") {
  if ((await existing()).length) {
    console.error("Test users already exist. Run `delete` first.");
    process.exit(1);
  }
  const password = `Dev-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}!`;
  for (const r of ROLES) {
    const { error } = await admin.auth.admin.createUser({
      email: emailOf(r), password, email_confirm: true, user_metadata: { display_name: `Dev ${r}` },
    });
    if (error) throw new Error(`${r}: ${error.message}`);
  }
  console.log("Created confirmed test users (all share this password):");
  ROLES.forEach((r) => console.log(`  ${emailOf(r)}`));
  console.log(`Password: ${password}`);
} else if (cmd === "delete") {
  const users = await existing();
  const ids = users.map((u) => u.id);
  if (ids.length) {
    // Delete their workspaces first: a sole owner cannot be removed while the workspace still exists.
    const ws = await admin.from("workspaces").delete().in("created_by", ids).select("id");
    if (ws.error) throw ws.error;
    console.log(`Deleted ${ws.data.length} workspace(s) created by test users.`);
  }
  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`${u.email}: ${error.message}`);
  }
  console.log(`Deleted ${users.length} test user(s).`);
} else {
  console.error("Usage: npm run dev:users -- create | delete");
  process.exit(2);
}
