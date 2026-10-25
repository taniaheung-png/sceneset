"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["owner", "organiser", "collaborator"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Result keys go in the URL (?m=…); the page maps them to fixed text, so no URL-supplied text is ever shown.
function keyFor(code: string | undefined): string {
  switch (code) {
    case "P0001": return "last-owner";
    case "P0002": return "not-found";
    case "23505": return "exists";
    case "42501": return "forbidden";
    case "22023": return "invalid";
    default: return "failed";
  }
}

async function finish(ws: string, key: string): Promise<never> {
  revalidatePath(`/w/${ws}/settings`);
  redirect(`/w/${ws}/settings?m=${key}`);
}

async function guard(fd: FormData) {
  const ws = field(fd, "ws");
  if (!isUuid(ws)) redirect("/app");
  await requireUser(`/w/${ws}/settings`);
  return { ws, supabase: await createClient() };
}

export async function renameWorkspace(fd: FormData) {
  const { ws, supabase } = await guard(fd);
  const name = field(fd, "name");
  if (name.length < 1 || name.length > 80) return finish(ws, "invalid");
  // RLS allows this only for owners; zero updated rows means "not allowed".
  const { data, error } = await supabase.from("workspaces").update({ name }).eq("id", ws).select("id");
  return finish(ws, error ? keyFor(error.code) : data?.length ? "renamed" : "forbidden");
}

export async function addMember(fd: FormData) {
  const { ws, supabase } = await guard(fd);
  const email = field(fd, "email");
  const role = field(fd, "role");
  if (!EMAIL.test(email) || !ROLES.includes(role)) return finish(ws, "invalid");
  const { error } = await supabase.rpc("add_workspace_member", { ws, member_email: email, member_role: role });
  return finish(ws, error ? keyFor(error.code) : "added");
}

export async function changeRole(fd: FormData) {
  const { ws, supabase } = await guard(fd);
  const target = field(fd, "user");
  const role = field(fd, "role");
  if (!isUuid(target) || !ROLES.includes(role)) return finish(ws, "invalid");
  const { error } = await supabase.rpc("set_member_role", { ws, target, new_role: role });
  return finish(ws, error ? keyFor(error.code) : "role-changed");
}

export async function removeMember(fd: FormData) {
  const { ws, supabase } = await guard(fd);
  const target = field(fd, "user");
  if (!isUuid(target)) return finish(ws, "invalid");
  const { error } = await supabase.rpc("remove_member", { ws, target });
  if (error) return finish(ws, keyFor(error.code));
  // Leaving removes your own access, so the workspace page would 404; go back to the entry point.
  const user = await requireUser();
  if (target === user.id) redirect("/app");
  return finish(ws, "removed");
}
