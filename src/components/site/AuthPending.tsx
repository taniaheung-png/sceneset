import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";

/** Shown instead of a form until Supabase Auth is connected (implementation phase 2). */
export function AuthPending({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <div className="mt-4 rounded-lg border border-rule bg-surface p-5">
        <StatusChip tone="warn">Not connected yet</StatusChip>
        <p className="mt-3 text-ink-2">
          Accounts arrive in implementation phase 2. Until then you can explore a read-only sample with fictional data;
          nothing is saved.
        </p>
        <div className="mt-4">
          <ButtonLink href="/demo">Try the demo</ButtonLink>
        </div>
      </div>
    </div>
  );
}
