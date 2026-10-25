import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/site/Brand";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requireUser } from "@/lib/auth";
import { createWorkspace } from "./actions";

export const metadata: Metadata = { title: "Create your workspace" };

export default async function Onboarding({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser("/onboarding");
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <Brand />
      <main id="main">
        <h1 className="mt-8 font-display text-3xl font-bold">Create your workspace</h1>
        <p className="mt-2 text-ink-2">
          A workspace is where your team plans events together. You will be its owner and can add teammates later.
        </p>
        <form action={createWorkspace} className="mt-6 flex flex-col gap-4 rounded-lg border border-rule bg-surface p-5">
          {sp.error && (
            <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm font-medium text-danger">
              {sp.error === "failed" ? "We could not create the workspace. Try again." : "Enter a workspace name of 1 to 80 characters."}
            </p>
          )}
          <TextField name="name" label="Workspace name" placeholder="Harbour Market Collective" maxLength={80} required />
          <SubmitButton pendingText="Creating…">Create workspace</SubmitButton>
          <p className="text-xs text-ink-2">
            Signed in as {user.email}. We keep your name and email to run your account; see the{" "}
            <Link href="/privacy" className="font-semibold underline">privacy notice</Link>.
          </p>
        </form>
      </main>
    </div>
  );
}
