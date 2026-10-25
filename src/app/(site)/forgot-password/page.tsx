import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/site/AuthForm";
import { AuthShell, Banner } from "@/components/site/AuthShell";
import { requestReset } from "../auth-actions";

export const metadata: Metadata = { title: "Reset your password" };

export default async function Forgot({ searchParams }: PageProps<"/forgot-password">) {
  const sp = await searchParams;
  return (
    <AuthShell title="Reset your password" intro="Enter your email and we will send a link to choose a new password.">
      {sp.error === "link" && (
        <Banner tone="danger">That reset link is invalid or has expired. Request a new one below.</Banner>
      )}
      <AuthForm
        action={requestReset}
        submit="Send reset link"
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      />
      <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-2">
        Remembered it? <Link href="/login" className="font-semibold text-primary underline">Sign in</Link>.
      </p>
    </AuthShell>
  );
}
