import Link from "next/link";

/** Short collection notice (PICS) shown where people type information into the product. */
export function CollectionNotice({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-xs text-ink-2">
      {children} What you enter is stored in your workspace to run your plan. Use fictional details while this is a
      prototype. See the <Link href="/privacy" className="font-semibold underline">privacy notice</Link>.
    </p>
  );
}
