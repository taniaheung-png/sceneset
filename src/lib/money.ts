// Money is stored as integer minor units (1/100 of the currency unit). No floating-point arithmetic on amounts.

/** Whole amounts show without decimals; anything with cents shows both digits so nothing is silently rounded. */
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

/**
 * Parses user input such as "1,234.56", "12" or "12.5" into integer minor units.
 * Returns null for anything else: negatives, more than 2 decimals, text, empty, or values too large to be exact.
 */
export function parseMajorToMinor(input: string): number | null {
  const s = input.trim();
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.replace(/,/g, "").split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}
