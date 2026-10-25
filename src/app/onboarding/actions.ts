"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createWorkspace(fd: FormData) {
  await requireUser("/onboarding");
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 80) redirect("/onboarding?error=name");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", { ws_name: name });
  if (error || !data) redirect("/onboarding?error=failed");
  redirect(`/w/${data}`);
}
