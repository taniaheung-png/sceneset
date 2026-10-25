"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
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
    case "53400": return "plan-limit";
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

export async function updateProfile(fd: FormData) {
  const { ws, supabase } = await guard(fd);
  const user = await requireUser();
  const name = field(fd, "display_name");
  if (name.length < 1 || name.length > 80) return finish(ws, "invalid");
  const { data, error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id).select("id");
  return finish(ws, error || !data?.length ? "failed" : "profile-saved");
}

/** Owners only. Typing the workspace name is the confirmation; the database function re-checks the owner role. */
export async function deleteWorkspace(fd: FormData) {
  const { ws, supabase } = await guard(fd);
  const { data: w } = await supabase.from("workspaces").select("name").eq("id", ws).maybeSingle();
  if (!w || field(fd, "confirm") !== w.name) return finish(ws, "confirm-mismatch");
  const { error } = await supabase.rpc("delete_workspace", { ws });
  if (error) return finish(ws, keyFor(error.code));
  redirect("/app");
}

/**
 * Permanently deletes the signed-in account. Order matters and nothing is removed until every check has passed:
 *  1. the typed email must match;  2. the server must have the admin key;
 *  3. no workspace may be left without an owner while other people are in it (the user must transfer ownership or delete it);
 *  4. workspaces where the user is the only member are deleted;  5. the auth account is deleted (profile and memberships follow;
 *     notes and tasks they wrote stay, with the author cleared).
 */
export async function deleteAccount(fd: FormData) {
  const { ws, supabase } = await guard(fd);
  const user = await requireUser();
  if (field(fd, "confirm").toLowerCase() !== user.email.toLowerCase()) return finish(ws, "confirm-mismatch");
  const admin = adminClient();
  if (!admin) return finish(ws, "delete-unavailable");
  const { data: blockers, error: bErr } = await supabase.rpc("account_deletion_blockers");
  if (bErr) return finish(ws, "failed");
  if ((blockers ?? []).length > 0) return finish(ws, "delete-blocked");
  const { error: wErr } = await supabase.rpc("remove_my_sole_workspaces");
  if (wErr) return finish(ws, "failed");
  const { error: dErr } = await admin.auth.admin.deleteUser(user.id);
  if (dErr) return finish(ws, "failed");
  await supabase.auth.signOut().catch(() => undefined); // clears the browser cookies; the account is already gone
  redirect("/?deleted=1");
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
