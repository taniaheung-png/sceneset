import Link from "next/link";
import { SamplePreview } from "@/components/site/SamplePreview";
import { BriefcaseIcon, CheckCircleIcon, ClockIcon, LayoutIcon, PrinterIcon, UsersIcon, WalletIcon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/Button";

const steps = [
  ["Create the event", "Name it, set the dates, venue and goals. It takes one short form."],
  ["Plan the work", "Assign tasks with due dates, record suppliers and compare their quotes side by side."],
  ["Control the money", "Budget by category. An accepted quote becomes a budget line once, with no double counting."],
  ["Build the day", "Write the running order with owners and times, then place tables, stage and entrances on the venue layout."],
  ["Check readiness and print", "See what is still open, then print one clear plan for the team."],
] as const;

const parts = [
  ["Task board", "To do, in progress and done, with owners and due dates."],
  ["Suppliers and quotes", "A supplier directory and a quote comparison for each event."],
  ["Budget", "Planned, committed and paid amounts with the remaining total."],
  ["Guests", "Invite list, RSVP status and a headcount against capacity."],
  ["Run of show", "A timed running order that handles events past midnight."],
  ["Venue layout", "A scaled floor plan you can adjust with the keyboard or by form."],
  ["Readiness and print", "A plain checklist, then a print-ready summary."],
] as const;

const plans = [
  ["Free Personal", "HKD 0", "to start"],
  ["Event Upgrade", "HKD 149", "per event"],
  ["Organiser", "HKD 299", "per month"],
] as const;

export default function Home() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
        <div>
          <p className="eyebrow">Event planning for small teams</p>
          <h1 className="text-[length:var(--text-hero)] font-bold leading-[1.04] tracking-[-0.045em] text-navy">
            One plan for the whole event.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-2">
            Tasks, suppliers, budget, guests, running order and venue layout in one shared plan, for event teams who are
            tired of chasing the latest spreadsheet.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/demo">Try the demo</ButtonLink>
            <ButtonLink href="/signup" variant="secondary">Create an event</ButtonLink>
          </div>
          <p className="mt-3 text-sm text-ink-2">The demo is read-only and uses fictional data. No sign-in needed.</p>
        </div>
        <SamplePreview />
      </section>

      <section aria-labelledby="problem" className="border-y border-rule bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-2">
          <h2 id="problem" className="page-title leading-tight">
            The budget is in a spreadsheet. The quotes are in a chat. The running order is in last week&apos;s document.
          </h2>
          <p className="self-end text-lg text-ink-2">
            Small event teams lose time and make mistakes when the plan is scattered. SceneSet puts it on one page so
            everyone works from the same current version.
          </p>
        </div>
      </section>

      <section id="how" aria-labelledby="how-h" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="how-h" className="text-2xl font-bold">How an event comes together</h2>
        <ol className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">
          {steps.map(([title, text], i) => (
            <li key={title} className="flex gap-4 border-t border-rule pt-4">
              <span className="num text-2xl font-bold text-coral-dark" aria-hidden>{i + 1}</span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="parts-h" className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <h2 id="parts-h" className="text-2xl font-bold">What goes in the plan</h2>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {parts.map(([name, text], i) => {
            const Icon = [CheckCircleIcon, BriefcaseIcon, WalletIcon, UsersIcon, ClockIcon, LayoutIcon, PrinterIcon][i] ?? CheckCircleIcon;
            return (
              <div key={name} className="panel flex gap-3 p-4">
                <span className={`tile !size-9 ${["", "tile-coral", "tile-sage", "tile-gold"][i % 4]}`}><Icon width={18} height={18} /></span>
                <div>
                  <dt className="font-bold text-navy">{name}</dt>
                  <dd className="text-sm text-ink-2">{text}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="price-h" className="border-y border-rule bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="price-h" className="text-2xl font-bold">Start free, upgrade when you need to</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {plans.map(([name, price, cadence]) => (
              <li key={name} className="panel p-4">
                <p className="font-semibold">{name}</p>
                <p className="num mt-1 text-2xl font-bold">{price} <span className="text-sm font-medium text-ink-2">{cadence}</span></p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-2">
            Provisional prices: unvalidated hypotheses, subject to change. Upgrades will use a test payment only, so no
            real payment is taken.
          </p>
          <div className="mt-4"><ButtonLink href="/pricing" variant="secondary">Compare plans</ButtonLink></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="page-title">See a sample plan before you sign up</h2>
        <p className="mt-2 max-w-xl text-ink-2">
          Open the read-only demo, or <Link href="/privacy" className="font-semibold text-primary underline">read how we handle data</Link>.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/demo">Try the demo</ButtonLink>
          <ButtonLink href="/signup" variant="secondary">Create an event</ButtonLink>
        </div>
      </section>
    </>
  );
}
