"use client";

import { Button, ButtonLink } from "@/components/ui/Button";

/** Shown when a page or a save fails unexpectedly (for example the connection dropped). It never claims anything was saved. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-ink-2">
        The page could not finish. If you were saving something it may not have been saved, so check before you enter it again. Anything saved earlier is not affected.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/app" variant="secondary">Back to your workspaces</ButtonLink>
      </div>
    </main>
  );
}
