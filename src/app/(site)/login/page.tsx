import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/site/AuthForm";
import { AuthShell, Banner } from "@/components/site/AuthShell";
import { getUser, safeNext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/config";
import { signIn } from "../auth-actions";

export const metadata: Metadata = { title: "Sign in" };

const MESSAGES: Record<string, string> = {
  config: "Sign-in is not set up on this server yet. Add the Supabase settings to .env.local (see README).",
  link: "That confirmation link is invalid or has expired. Sign in, or create the account again to get a new link.",
};

export default async function Login({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  if (supabaseConfigured && (await getUser())) redirect(next);
  const err = typeof sp.error === "string" ? MESSAGES[sp.error] : undefined;

  return (
    <AuthShell title="Sign in" intro="Welcome back. Pick up where your event plan left off.">
      {err && <Banner tone="danger">{err}</Banner>}
      <AuthForm
        action={signIn}
        submit="Sign in"
        hidden={{ next }}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      >
        <p className="text-sm">
          <Link href="/forgot-password" className="font-semibold text-primary underline">Forgot your password?</Link>
        </p>
      </AuthForm>
      <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-2">
        New here? <Link href="/signup" className="font-semibold text-primary underline">Create an account</Link>, or{" "}
        <Link href="/demo" className="font-semibold text-primary underline">try the read-only demo</Link>.
      </p>
    </AuthShell>
  );
}
