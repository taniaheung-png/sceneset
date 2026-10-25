import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Signed-in entry point: go to your workspace, or create one.
export default async function AppEntry() {
  await requireUser("/app");
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("id").order("created_at").limit(1);
  redirect(data?.[0] ? `/w/${data[0].id}/events` : "/onboarding");
}
