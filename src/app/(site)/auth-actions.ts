"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
import { siteUrl, supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; notice?: string; done?: boolean; values?: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

const NOT_CONFIGURED: FormState = { error: "Sign-in is not set up on this server yet. Add the Supabase settings to .env.local." };

// Maps Supabase error codes to plain-language messages. Unknown codes stay generic (no internals leaked).
function authMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "That email and password do not match an account.";
    case "email_not_confirmed":
      return "Confirm your email first: open the link we sent you, then sign in.";
    case "weak_password":
      return "Choose a stronger password (at least 8 characters, not a common one).";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many emails were requested. Wait a while and try again. The built-in email service allows only a few messages per hour.";
    case "email_address_not_authorized":
      return "The built-in email service can only send to members of the Supabase project team. Add this address to the team, or configure custom SMTP.";
    case "same_password":
      return "Choose a password different from your current one.";
    default:
      return fallback;
  }
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  if (!supabaseConfigured) return NOT_CONFIGURED;
  const values = { email: text(fd, "email"), displayName: text(fd, "displayName") };
  const password = String(fd.get("password") ?? "");
  if (!values.displayName) return { error: "Enter your name.", values };
  if (!EMAIL.test(values.email)) return { error: "Enter a valid email address.", values };
  if (password.length < 8) return { error: "Use a password of at least 8 characters.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: values.email,
    password,
    options: {
      data: { display_name: values.displayName },
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/app`,
    },
  });
  if (error) return { error: authMessage(error.code, "We could not create the account. Try again."), values };
  // Same message whether or not the address already had an account (no account enumeration).
  return { done: true, notice: "Check your email. We sent a link to confirm your address; you can sign in once you have opened it." };
}

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  if (!supabaseConfigured) return NOT_CONFIGURED;
  const values = { email: text(fd, "email") };
  const password = String(fd.get("password") ?? "");
  if (!EMAIL.test(values.email) || !password) return { error: "Enter your email and password.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: values.email, password });
  if (error) return { error: authMessage(error.code, "We could not sign you in. Try again."), values };
  redirect(safeNext(text(fd, "next")));
}

export async function signOut() {
  if (supabaseConfigured) await (await createClient()).auth.signOut();
  redirect("/");
}

export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  if (!supabaseConfigured) return NOT_CONFIGURED;
  const values = { email: text(fd, "email") };
  if (!EMAIL.test(values.email)) return { error: "Enter a valid email address.", values };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });
  if (error && ["over_email_send_rate_limit", "over_request_rate_limit", "email_address_not_authorized"].includes(error.code ?? "")) {
    return { error: authMessage(error.code, ""), values };
  }
  // Same message whether or not an account exists.
  return { done: true, notice: "If an account exists for that address, we sent a link to reset the password. The link expires, so use it soon." };
}

export async function updatePassword(_: FormState, fd: FormData): Promise<FormState> {
  if (!supabaseConfigured) return NOT_CONFIGURED;
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The two passwords do not match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authMessage(error.code, "We could not change the password. The link may have expired; request a new one.") };
  redirect("/app");
}
