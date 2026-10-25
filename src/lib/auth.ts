import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export type SessionUser = { id: string; email: string };

/** Verified identity from the JWT (signature checked), or null. Never trusts unverified cookie data. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  return c?.sub ? { id: c.sub, email: typeof c.email === "string" ? c.email : "" } : null;
});

/** For private pages and actions: redirects to login (remembering where to return) when signed out. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** Only same-site relative paths are allowed as a post-login destination (blocks open redirects). */
export function safeNext(value: unknown, fallback = "/app"): string {
  return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : fallback;
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
