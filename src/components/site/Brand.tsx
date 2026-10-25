import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-display text-xl font-bold" aria-label="SceneSet home">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect width="26" height="26" rx="6" fill="var(--primary)" />
        <rect x="6" y="7" width="14" height="3" rx="1.5" fill="var(--on-primary)" />
        <rect x="6" y="12" width="9" height="3" rx="1.5" fill="var(--on-primary)" />
        <circle cx="19" cy="18.5" r="3" fill="var(--cue)" />
      </svg>
      SceneSet
    </Link>
  );
}
