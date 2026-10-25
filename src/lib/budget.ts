// Budget arithmetic on integer minor units (1/100 of the currency unit). Everything is derived from the rows;
// nothing is stored twice. See PRD section 5 for the definitions.

export type BudgetLine = { planned_minor: number; committed_minor: number; paid_minor: number };

export type BudgetTotals = {
  /** Sum of planned amounts. */
  planned: number;
  /** Sum of actual/committed amounts (what has been agreed to spend). Accepted quotes count once, via their budget line. */
  committed: number;
  /** Sum of paid amounts. */
  paid: number;
  /** committed - paid: still to be paid. */
  outstanding: number;
  /** target - committed. Negative means over budget. Null when no target is set. */
  remaining: number | null;
  /** committed - planned. Positive means spending above plan. */
  variance: number;
  hasTarget: boolean;
  /** True only when a target exists and commitments exceed it. */
  over: boolean;
};

export function budgetTotals(lines: BudgetLine[], targetMinor: number): BudgetTotals {
  const sum = (k: keyof BudgetLine) => lines.reduce((t, l) => t + l[k], 0);
  const planned = sum("planned_minor");
  const committed = sum("committed_minor");
  const paid = sum("paid_minor");
  const hasTarget = targetMinor > 0;
  const remaining = hasTarget ? targetMinor - committed : null;
  return { planned, committed, paid, outstanding: committed - paid, remaining, variance: committed - planned, hasTarget, over: remaining !== null && remaining < 0 };
}

/** Whole-number percentage, or null when the denominator is zero/invalid (never NaN or Infinity). */
export function percent(part: number, whole: number): number | null {
  return whole > 0 && Number.isFinite(part) ? Math.round((part / whole) * 100) : null;
}

/** Plain-language reading of a signed amount, so the sign is never left to interpretation. */
export const explainRemaining = (t: BudgetTotals): string =>
  t.remaining === null ? "No budget target set" : t.over ? "Over budget" : t.remaining === 0 ? "Exactly on budget" : "Left to commit";

export const explainVariance = (t: BudgetTotals): string =>
  t.variance > 0 ? "Above plan" : t.variance < 0 ? "Below plan" : "On plan";
