/**
 * Plans, limits and entitlement rules in one place. TEST MODE ONLY: nothing here charges anyone.
 * The prices are unvalidated hypotheses (PRD §1.1); the database applies the same limits (migration 007),
 * and `tests/phase7.test.mjs` checks this module against the numbers the PRD states.
 */

export type PlanId = "event" | "organiser";
export type Tier = "free" | "event" | "organiser";

export const PRICE_NOTE = "Provisional prices: unvalidated hypotheses for this prototype, not offers.";
export const TEST_NOTE = "Test mode. No real payment is taken and no card details are collected.";

export const FREE = { name: "Free Personal", price: "HKD 0", cadence: "to start", maxEvents: 1, maxMembers: 3 } as const;

/** What the pricing page and the upgrade page both print, so the wording cannot drift. */
export const PLANS = [
  {
    id: "free",
    name: FREE.name,
    price: FREE.price,
    cadence: FREE.cadence,
    points: ["All planning tools", "1 active event", "You plus up to 2 collaborators (3 members)"],
  },
  {
    id: "event",
    name: "Event Upgrade",
    price: "HKD 149",
    cadence: "per event, one-off",
    points: ["Applies to one event you choose", "Up to 10 members in the workspace", "Printed summary without the SceneSet footer", "Everything in Free Personal"],
  },
  {
    id: "organiser",
    name: "Organiser",
    price: "HKD 299",
    cadence: "per month",
    points: ["Unlimited active events", "Unlimited members", "Printed summary without the SceneSet footer", "Everything in Free Personal"],
  },
] as const;

export const isPlanId = (v: unknown): v is PlanId => v === "event" || v === "organiser";

export type Entitlement = {
  tier: Tier;
  label: string;
  maxEvents: number | null; // null = unlimited
  maxMembers: number | null;
};

/** `plan` is workspaces.plan; `upgradedEvents` is how many of its events have event_upgrade set. */
export function entitlement(plan: string, upgradedEvents: number): Entitlement {
  if (plan === "organiser") return { tier: "organiser", label: "Organiser (test)", maxEvents: null, maxMembers: null };
  if (upgradedEvents > 0) return { tier: "event", label: "Free Personal with Event Upgrade (test)", maxEvents: FREE.maxEvents, maxMembers: 10 };
  return { tier: "free", label: FREE.name, maxEvents: FREE.maxEvents, maxMembers: FREE.maxMembers };
}

const within = (limit: number | null, used: number) => limit === null || used < limit;
export const canAddEvent = (e: Entitlement, activeEvents: number) => within(e.maxEvents, activeEvents);
export const canAddMember = (e: Entitlement, members: number) => within(e.maxMembers, members);

/** The printed summary drops its footer for an upgraded event or an Organiser workspace. */
export const brandingFree = (plan: string, eventUpgrade: boolean) => plan === "organiser" || eventUpgrade;

export const limitText = (n: number | null) => (n === null ? "unlimited" : String(n));

/** Messages for the owner-facing result of a checkout; the URL carries only one of these keys. */
export const CHECKOUT_RESULTS = ["success", "cancelled", "failed", "replayed", "ended", "covered", "forbidden", "invalid", "unavailable", "error"] as const;
export type CheckoutResult = (typeof CHECKOUT_RESULTS)[number];

export function resultFromError(code: string | undefined): CheckoutResult {
  switch (code) {
    case "42501": return "forbidden";
    case "22023":
    case "P0002": return "invalid";
    case "P0001": return "covered";
    default: return "error";
  }
}

/** The local sandbox is off unless this server is explicitly configured for it. It never talks to a payment provider. */
export const sandboxEnabled = (env: Record<string, string | undefined> = process.env) => env.PAYMENT_SANDBOX_ENABLED === "true";

/** A request key is a random token minted by the server for one checkout page. */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{16,64}$/;
