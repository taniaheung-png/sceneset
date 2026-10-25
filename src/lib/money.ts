// Money is stored as integer minor units (1/100). Display only; parsing/validation lands with Phase 2 (P2.20).
// Whole amounts show without decimals; anything with cents shows both digits so nothing is silently rounded.
export function formatMinor(minor: number, currency: string): string {
  const digits = minor % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency,
    currencyDisplay: "code", // "HKD 80,000", matching the pricing copy
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 100);
}
