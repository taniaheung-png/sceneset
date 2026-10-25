import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { PLANS, PRICE_NOTE, isPlanId, sandboxEnabled } from "@/lib/entitlements";
import { isUuid } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { completeCheckout } from "../actions";

export const metadata: Metadata = { title: "Test checkout" };

/**
 * The simulated checkout. There is no payment form: no card, name, address or amount is collected or sent anywhere.
 * The only inputs are hidden (workspace, plan, event, a one-time request key) and three buttons that say how the
 * simulation should end. The server action decides everything; this page grants nothing.
 */
export default async function Sandbox({ params, searchParams }: PageProps<"/w/[ws]/upgrade/sandbox">) {
  const { ws } = await params;
  const sp = await searchParams;
  const { workspace, role } = await getWorkspace(ws);
  const back = `/w/${ws}/upgrade`;
  const plan = typeof sp.plan === "string" ? sp.plan : "";
  const evId = typeof sp.event === "string" ? sp.event : "";

  const stop = (text: string) => (
    <>
      <PageHeader event={workspace.name} title="Test checkout" />
      <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm font-medium text-danger" data-blocked>{text}</p>
      <Link href={back} className="text-sm font-semibold text-primary underline">Back to plans</Link>
    </>
  );

  if (!sandboxEnabled()) return stop("The test checkout is switched off on this server.");
  if (role !== "owner") return stop("Only workspace owners can change test plans.");
  if (!isPlanId(plan)) return stop("That plan is not one you can try. Choose a plan from the plans page.");

  let eventTitle = "";
  if (plan === "event") {
    if (!isUuid(evId)) return stop("Choose which event to upgrade from the plans page.");
    const { data: ev } = await (await createClient())
      .from("events").select("title, event_upgrade, demo").eq("id", evId).eq("workspace_id", ws).maybeSingle();
    if (!ev || ev.demo) return stop("That event was not found in this workspace.");
    if (ev.event_upgrade) return stop("That event already has the test upgrade.");
    eventTitle = ev.title;
  } else if (workspace.plan === "organiser") {
    return stop("This workspace is already on the test Organiser plan.");
  }

  const p = PLANS.find((x) => x.id === plan)!;
  const key = crypto.randomUUID(); // one request key per page view; submitting the same form twice is a replay, not a second upgrade

  return (
    <>
      <PageHeader event={workspace.name} title="Test checkout" />
      <p role="note" className="rounded-md bg-warn-tint p-4 text-base font-bold text-warn-ink" data-test-mode>
        Test mode — No real payment taken. No card details are collected.
      </p>

      <section aria-labelledby="c-sum" className="max-w-xl rounded-lg border border-rule bg-surface p-5">
        <h2 id="c-sum" className="text-lg font-bold">{p.name}</h2>
        <p className="num mt-1 text-2xl font-bold">{p.price} <span className="text-base font-normal text-ink-2">{p.cadence}</span></p>
        {plan === "event" && <p className="mt-1 text-sm">For the event: <strong>{eventTitle}</strong></p>}
        <p className="mt-2 text-xs text-ink-2">{PRICE_NOTE} This amount is shown for illustration; nothing is charged.</p>

        <form action={completeCheckout} className="mt-5 flex flex-col gap-3">
          <input type="hidden" name="ws" value={ws} />
          <input type="hidden" name="plan" value={plan} />
          <input type="hidden" name="ev" value={plan === "event" ? evId : ""} />
          <input type="hidden" name="key" value={key} />
          <p className="text-sm font-semibold">Choose how this simulation ends:</p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" name="outcome" value="success" className={buttonClass("primary")}>Simulate success</button>
            <button type="submit" name="outcome" value="cancelled" className={buttonClass("secondary")}>Simulate cancellation</button>
            <button type="submit" name="outcome" value="failed" className={buttonClass("secondary")}>Simulate failure</button>
          </div>
          <p className="text-xs text-ink-2">Only success changes the plan. Cancellation and failure are logged and change nothing.</p>
        </form>
        <p className="mt-4"><Link href={back} className="text-sm font-semibold text-primary underline">Back to plans without choosing</Link></p>
      </section>
    </>
  );
}
