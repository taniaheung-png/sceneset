import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Pricing" };

// Provisional amounts: implementation hypotheses (PRD §1.1 L7), not validated prices.
const plans = [
  {
    name: "Free Personal",
    price: "HKD 0",
    cadence: "to start",
    points: ["One active event", "You plus up to 2 collaborators", "All planning tools"],
  },
  {
    name: "Event Upgrade",
    price: "HKD 149",
    cadence: "per event, paid once",
    points: ["Applies to one event", "Up to 10 team members on that event", "Everything in Free Personal"],
  },
  {
    name: "Organiser",
    price: "HKD 299",
    cadence: "per month",
    points: ["Unlimited active events", "Unlimited team members", "Everything in Free Personal"],
  },
] as const;

export default function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-bold">Pricing</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">Start free. Upgrade one event, or go monthly if you organise often.</p>
      <p role="note" className="mt-4 max-w-2xl rounded-md bg-warn-tint p-3 text-sm text-warn-ink">
        <strong>Provisional prices.</strong> These amounts are unvalidated hypotheses for this prototype and may change.
        Paid plans use a test payment only: no real payment is taken, and no card details are collected.
      </p>

      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <li key={p.name} className="flex flex-col rounded-lg border border-rule bg-surface p-5">
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="num mt-2 text-3xl font-bold">{p.price}</p>
            <p className="text-sm text-ink-2">{p.cadence}</p>
            <ul className="mt-4 flex flex-col gap-2 border-t border-rule pt-4 text-sm">
              {p.points.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ButtonLink href="/signup">Create a free account</ButtonLink>
        <p className="text-sm text-ink-2">Test upgrades open after sign-in once they are built (implementation phase 7).</p>
      </div>
    </div>
  );
}
