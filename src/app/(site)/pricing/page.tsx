import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { PLANS, TEST_NOTE } from "@/lib/entitlements";

export const metadata: Metadata = { title: "Pricing" };

// Fictional, static examples of how supplier suggestions might look one day. No links, no booking, no commission.
const referrals = [
  { name: "Harbour Sound & Light (fictional)", does: "Stage sound and lighting for events of 50 to 300 guests", area: "Hong Kong Island" },
  { name: "Lantern Table Hire (fictional)", does: "Round tables, linen and chairs", area: "Kowloon" },
  { name: "Market Bites Catering (fictional)", does: "Street-food style catering for standing events", area: "New Territories" },
] as const;

export default function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-bold">Pricing</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">Start free. Upgrade one event, or go monthly if you organise often.</p>
      <p role="note" className="mt-4 max-w-2xl rounded-md bg-warn-tint p-3 text-sm text-warn-ink" data-price-note>
        <strong>Provisional prices.</strong> They are unvalidated hypotheses for this prototype, not offers. Paid plans use a simulated checkout only. {TEST_NOTE}
      </p>

      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <li key={p.id} className="flex flex-col rounded-lg border border-rule bg-surface p-5" data-plan-card={p.id}>
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
      <p className="mt-4 max-w-3xl text-sm text-ink-2">
        Every planning feature works on Free Personal. Upgrades raise the limits above and remove the SceneSet footer from printed summaries.
        There is no metering, tax, invoice, coupon or proration, and no recurring billing exists in this prototype.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ButtonLink href="/signup">Create a free account</ButtonLink>
        <p className="text-sm text-ink-2">
          Signed-in workspace owners can try the test upgrades under <strong>Plan</strong> in their workspace.
        </p>
      </div>

      <section aria-labelledby="referrals" className="mt-14 rounded-lg border border-dashed border-control bg-sunken p-5" data-referrals>
        <h2 id="referrals" className="text-lg font-bold">Supplier suggestions: a concept</h2>
        <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-2">Illustrative — not a live marketplace. These suppliers are fictional.</p>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          One day SceneSet could suggest suppliers that fit your event. Nothing here can be booked, contacted or bought, and SceneSet earns nothing from it.
        </p>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {referrals.map((r) => (
            <li key={r.name} className="rounded-md border border-rule bg-surface p-4 text-sm">
              <p className="font-semibold">{r.name}</p>
              <p className="mt-1">{r.does}</p>
              <p className="mt-1 text-ink-2">{r.area}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
