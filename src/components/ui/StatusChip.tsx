type Tone = "neutral" | "info" | "success" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink",
  info: "bg-info-tint text-info",
  success: "bg-success-tint text-success",
  warn: "bg-warn-tint text-warn-ink",
  danger: "bg-danger-tint text-danger",
};

// Shape differs per tone so status never relies on colour alone; the label is always shown too.
const shapes: Record<Tone, string> = {
  neutral: "rounded-full",
  info: "rounded-full border-2 border-current bg-transparent",
  success: "rounded-full",
  warn: "rotate-45 rounded-[2px]",
  danger: "rounded-[2px]",
};

export function StatusChip({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      <span aria-hidden className={`inline-block size-2 bg-current ${shapes[tone]}`} />
      {children}
    </span>
  );
}
