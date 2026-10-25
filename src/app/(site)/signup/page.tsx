import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/site/AuthForm";
import { AuthShell } from "@/components/site/AuthShell";
import { signUp } from "../auth-actions";

export const metadata: Metadata = { title: "Create an account" };

export default function Signup() {
  return (
    <AuthShell title="Create an account" intro="One account for all your events. Free to start.">
      <AuthForm
        action={signUp}
        submit="Create account"
        fields={[
          { name: "displayName", label: "Your name", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 8 characters." },
        ]}
      />
      <p className="mt-4 text-xs text-ink-2">
        We store your name and email to run your account and show teammates who you are. See our{" "}
        <Link href="/privacy" className="font-semibold underline">privacy notice</Link>.
      </p>
      <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-2">
        Already have an account? <Link href="/login" className="font-semibold text-primary underline">Sign in</Link>.
      </p>
    </AuthShell>
  );
}
