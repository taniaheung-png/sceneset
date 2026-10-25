import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for emailed links (sign-up confirmation and password reset).
 * Supports both shapes Supabase can send:
 *   ?token_hash=...&type=...  (custom email templates; works from any browser/device)
 *   ?code=...                 (default templates, PKCE; works only in the browser that requested it)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const failed = new URL(next === "/reset-password" ? "/forgot-password?error=link" : "/login?error=link", request.url);
  if (!supabaseConfigured) return NextResponse.redirect(new URL("/login?error=config", request.url));

  const supabase = await createClient();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  let error: unknown = new Error("missing token");
  if (tokenHash && type) ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  else if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));

  return NextResponse.redirect(error ? failed : new URL(next, request.url));
}
