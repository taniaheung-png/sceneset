import { notFound } from "next/navigation";
import { cache } from "react";
import { isUuid, requireUser } from "./auth";
import { createClient } from "./supabase/server";

export type Role = "owner" | "organiser" | "collaborator";

/**
 * Loads a workspace the signed-in user belongs to. RLS already hides other workspaces; we also 404 on
 * a malformed or foreign ID so nothing about its existence is disclosed.
 */
export const getWorkspace = cache(async (id: string) => {
  const user = await requireUser(`/w/${id}`);
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [ws, member] = await Promise.all([
    supabase.from("workspaces").select("id, name, plan").eq("id", id).maybeSingle(),
    supabase.from("workspace_members").select("role").eq("workspace_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!ws.data || !member.data) notFound();
  return { user, workspace: ws.data, role: member.data.role as Role };
});
