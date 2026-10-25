import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/site/AuthForm";
import { AuthShell } from "@/components/site/AuthShell";
import { getUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/config";
import { updatePassword } from "../auth-actions";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function Reset() {
  // The emailed link signs the person in with a short-lived recovery session; without it there is nothing to reset.
  const user = supabaseConfigured ? await getUser() : null;
  if (!user) {
    return (
      <AuthShell title="Reset link expired">
        <p className="text-ink-2">This page needs a valid reset link. Links expire, so request a new one.</p>
        <p className="mt-4">
          <Link href="/forgot-password" className="font-semibold text-primary underline">Request a new link</Link>
        </p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" intro={`Signed in as ${user.email}.`}>
      <AuthForm
        action={updatePassword}
        submit="Save new password"
        fields={[
          { name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 8 characters." },
          { name: "confirm", label: "Repeat new password", type: "password", autoComplete: "new-password" },
        ]}
      />
    </AuthShell>
  );
}
