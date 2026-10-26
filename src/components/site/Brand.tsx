import Link from "next/link";

/** The mark and two-tone wordmark. `tagline` adds the small line used in the app sidebar. */
export function Brand({ tagline = false, href = "/" }: { tagline?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="SceneSet home">
      <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden className="shrink-0">
        <rect width="38" height="38" rx="10" fill="var(--navy)" />
        <rect x="10" y="11" width="18" height="3.4" rx="1.7" fill="var(--paper)" />
        <rect x="10" y="17.3" width="11" height="3.4" rx="1.7" fill="var(--paper)" />
        <circle cx="26" cy="26" r="3.6" fill="var(--coral)" />
      </svg>
      <span className="leading-none">
        <span className="block text-[1.375rem] font-bold tracking-[-0.045em] text-navy">
          Scene<span className="text-coral-dark">Set</span>
        </span>
        {tagline && <span className="mt-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-ink-2">Event workspace</span>}
      </span>
    </Link>
  );
}
