/** Shown while a workspace page loads. Plain text on purpose: it must work without any data. */
export default function Loading() {
  return (
    <p role="status" className="p-2 text-sm text-ink-2">
      Loading…
    </p>
  );
}
