// Checks WCAG contrast for every text/control colour pair against tokens in globals.css.
// Usage: npm run contrast   (exit 1 if any pair fails)
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const root = css.slice(css.indexOf(":root"), css.indexOf("@theme inline"));
const tok = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground token, background token, minimum ratio, note]
const pairs = [
  ["ink", "paper", 4.5, "body text"],
  ["ink", "surface", 4.5, "body text on cards"],
  ["ink", "sunken", 4.5, "table headers"],
  ["ink-2", "paper", 4.5, "secondary text"],
  ["ink-2", "surface", 4.5, "secondary text on cards"],
  ["ink-2", "sunken", 4.5, "secondary text on wells"],
  ["on-primary", "primary", 4.5, "primary button text"],
  ["on-primary", "primary-hover", 4.5, "primary button hover"],
  ["primary", "paper", 4.5, "links on paper"],
  ["primary", "surface", 4.5, "links on cards"],
  ["primary", "primary-tint", 4.5, "selected nav"],
  ["ink", "cue", 4.5, "accent fill with ink text"],
  ["danger", "surface", 4.5, "error text"],
  ["danger", "danger-tint", 4.5, "danger chip"],
  ["info", "info-tint", 4.5, "info chip"],
  ["success", "success-tint", 4.5, "success chip"],
  ["warn-ink", "warn-tint", 4.5, "warning chip"],
  ["coral-dark", "surface", 4.5, "eyebrow and urgent date on cards"],
  ["coral-dark", "paper", 4.5, "eyebrow on the page"],
  ["coral-dark", "coral-soft", 4.5, "coral count badge"],
  ["navy", "blue-soft", 4.5, "date tile and icon tile"],
  ["ink-2", "blue-soft", 4.5, "date tile month"],
  ["ink-2", "coral-soft", 4.5, "secondary text on coral tint"],
  ["warn-ink", "gold-soft", 4.5, "gold tile and notice"],
  ["success", "sage-soft", 4.5, "sage tile and confirmed pill"],
  ["surface", "navy", 4.5, "text on the navy card"],
  ["control", "paper", 3, "control border on paper"],
  ["control", "surface", 3, "control border on cards"],
  ["primary", "paper", 3, "focus ring on paper"],
  ["primary", "surface", 3, "focus ring on cards"],
];

let failed = 0;
for (const [f, b, min, note] of pairs) {
  const r = ratio(tok[f], tok[b]);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${r.toFixed(2).padStart(5)} (min ${min}) ${f} on ${b} — ${note}`);
}
console.log(failed ? `\n${failed} pair(s) failed` : `\nAll ${pairs.length} pairs pass`);
process.exit(failed ? 1 : 0);
