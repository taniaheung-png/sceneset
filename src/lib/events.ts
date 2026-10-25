import { notFound } from "next/navigation";
import { cache } from "react";
import { isUuid } from "./auth";
import { createClient } from "./supabase/server";
import type { EventRow, MemberRow } from "./types";
import { getWorkspace } from "./workspace";

/** The event, only if it belongs to this workspace and the user is a member. Anything else is a plain 404. */
export const getEvent = cache(async (ws: string, ev: string) => {
  const ctx = await getWorkspace(ws);
  if (!isUuid(ev)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*, venues(id, name)")
    .eq("id", ev)
    .eq("workspace_id", ws)
    .maybeSingle();
  if (!data) notFound();
  return { ...ctx, event: data as EventRow, canManage: ctx.role !== "collaborator" };
});

export const getMembers = cache(async (ws: string): Promise<MemberRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_workspace_members", { ws });
  return (data ?? []) as MemberRow[];
});
