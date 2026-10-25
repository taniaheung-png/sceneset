import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Brand } from "./Brand";

// No display utility here: callers add `inline-flex` or `hidden sm:inline-flex` (the two would conflict).
const link = "min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-sunken";

export function SiteHeader() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Brand />
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link href="/#how" className={`${link} hidden md:inline-flex`}>How it works</Link>
          <Link href="/pricing" className={`${link} hidden sm:inline-flex`}>Pricing</Link>
          <Link href="/login" className={`${link} inline-flex`}>Sign in</Link>
          <ButtonLink href="/demo">Try demo</ButtonLink>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-rule bg-sunken">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md text-sm text-ink-2">
          <Brand />
          <p className="mt-2">
            SceneSet is a prototype. Demo data is fictional. Prices are unvalidated hypotheses and no real payment is
            ever taken.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-2 text-sm font-semibold">
            <li><Link href="/demo" className={`${link} inline-flex`}>Try demo</Link></li>
            <li><Link href="/pricing" className={`${link} inline-flex`}>Pricing</Link></li>
            <li><Link href="/privacy" className={`${link} inline-flex`}>Privacy</Link></li>
            <li><Link href="/login" className={`${link} inline-flex`}>Sign in</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}

/** Temporary build notice. Remove (or update) at the final handover phase. */
export function PrototypeNotice() {
  return (
    <p role="note" className="bg-cue px-4 py-2 text-center text-sm font-medium text-ink">
      <strong>Prototype build, phase 4 of 8.</strong> Accounts, events, tasks, notes, suppliers, quotes and budgets are built; the
      rest of the planning tools (guests, running order, layout) are not built yet.
    </p>
  );
}
