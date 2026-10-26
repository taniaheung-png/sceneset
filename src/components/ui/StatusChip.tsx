type Tone = "neutral" | "info" | "success" | "warn" | "danger";

// The reference's status pills: a soft tint with a plain text label. The label is always shown, so colour is never the only cue.
const tones: Record<Tone, string> = {
  neutral: "pill",
  info: "pill pill-info",
  success: "pill pill-success",
  warn: "pill pill-warn",
  danger: "pill pill-danger",
};

export function StatusChip({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={tones[tone]}>{children}</span>;
}
