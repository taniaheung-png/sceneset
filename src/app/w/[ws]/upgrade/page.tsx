import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Banner } from "@/components/site/AuthShell";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SelectField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { PLANS, PRICE_NOTE, TEST_NOTE, canAddEvent, canAddMember, entitlement, limitText, sandboxEnabled } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { endOrganiser } from "./actions";

export const metadata: Metadata = { title: "Plan" };

const RESULTS: Record<string, ["info" | "danger", string]> = {
  success: ["info", "Test upgrade recorded. The plan below is what the database now holds."],
  cancelled: ["info", "Checkout cancelled. Nothing was changed."],
  failed: ["danger", "The simulated payment failed. Nothing was changed."],
  replayed: ["info", "That checkout was already processed. Nothing was changed a second time."],
  ended: ["info", "The test Organiser plan was ended. This workspace is back on Free Personal limits."],
  covered: ["danger", "The current test plan already covers that. Nothing was changed."],
  forbidden: ["danger", "Only workspace owners can change test plans. Nothing was changed."],
  invalid: ["danger", "That request was not valid for this workspace. Nothing was changed."],
  unavailable: ["danger", "The test checkout is switched off on this server. Nothing was changed."],
  error: ["danger", "Something went wrong. Nothing was changed; try again."],
};

export default async function Upgrade({ params, searchParams }: PageProps<"/w/[ws]/upgrade">) {
  const { ws } = await params;
  const sp = await searchParams;
  const { workspace, role } = await getWorkspace(ws);
  const isOwner = role === "owner";
  const supabase = await createClient();
  const [{ data: evData }, { count: memberCount }, { data: log }] = await Promise.all([
    supabase.from("events").select("id, title, event_upgrade, archived_at, demo").eq("workspace_id", ws).order("starts_at"),
    supabase.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", ws),
    isOwner
      ? supabase.from("entitlement_events").select("id, plan, outcome, created_at, event_id").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(8)
      : Promise.resolve({ data: [] as { id: string; plan: string; outcome: string; created_at: string; event_id: string | null }[] }),
  ]);
  const events = (evData ?? []) as { id: string; title: string; event_upgrade: boolean; archived_at: string | null; demo: boolean }[];
  const upgraded = events.filter((e) => e.event_upgrade);
  const active = events.filter((e) => !e.archived_at && !e.demo).length;
  const ent = entitlement(workspace.plan, upgraded.length);
  const enabled = sandboxEnabled();

  // A banner is shown only for what the database agrees with; a hand-typed ?r=success on a free workspace shows nothing.
  const r = typeof sp.r === "string" ? sp.r : "";
  const backed = r !== "success" || ent.tier !== "free";
  const msg = backed ? RESULTS[r] : undefined;
  const buyable = events.filter((e) => !e.event_upgrade && !e.demo);
  const titleOf = (id: string | null) => events.find((e) => e.id === id)?.title ?? (id ? "an event" : "");

  return (
    <>
      <PageHeader event={workspace.name} title="Plan and test upgrades" />
      <p role="note" className="rounded-md bg-warn-tint p-3 text-sm font-medium text-warn-ink" data-test-mode>
        {TEST_NOTE} {PRICE_NOTE}
      </p>
      {!enabled && <Banner tone="info">The test checkout is switched off on this server, so plans cannot be changed here.</Banner>}
      {msg && <Banner tone={msg[0]}>{msg[1]}</Banner>}

      <section aria-labelledby="u-now" className="rounded-lg border border-rule bg-surface p-5" data-plan={ent.tier}>
        <h2 id="u-now" className="text-lg font-bold">Current plan</h2>
        <p className="mt-1 text-base font-semibold">{ent.label}</p>
        <dl className="num mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div data-usage="events">
            <dt className="text-ink-2">Active events</dt>
            <dd className="font-semibold">{active} of {limitText(ent.maxEvents)}{!canAddEvent(ent, active) && " (limit reached)"}</dd>
          </div>
          <div data-usage="members">
            <dt className="text-ink-2">Members</dt>
            <dd className="font-semibold">{memberCount ?? 0} of {limitText(ent.maxMembers)}{!canAddMember(ent, memberCount ?? 0) && " (limit reached)"}</dd>
          </div>
        </dl>
        {upgraded.length > 0 && (
          <p className="mt-3 text-sm" data-upgraded>
            Event Upgrade (test) on: {upgraded.map((e) => e.title).join(", ")}.
          </p>
        )}
        <p className="mt-3 text-xs text-ink-2">
          Sample events and archived events do not count toward the event limit. Limits are checked by the database as well as the app.
        </p>
      </section>

      <ul className="grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <li key={p.id} className="flex min-w-0 flex-col rounded-lg border border-rule bg-surface p-5" data-plan-card={p.id}>
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="num mt-2 text-3xl font-bold">{p.price}</p>
            <p className="text-sm text-ink-2">{p.cadence}</p>
            <ul className="mt-4 flex flex-col gap-2 border-t border-rule pt-4 text-sm">
              {p.points.map((x) => <li key={x}>{x}</li>)}
            </ul>
            <div className="mt-auto pt-4">
              {p.id === "free" && ent.tier === "free" && <StatusChip tone="info">Current plan</StatusChip>}
              {p.id === "event" && (
                isOwner && enabled ? (
                  buyable.length === 0 ? (
                    <p className="text-sm text-ink-2">{events.length === 0 ? "Create an event first, then upgrade it here." : "Every event here already has the upgrade."}</p>
                  ) : ent.tier === "organiser" ? (
                    <p className="text-sm text-ink-2">Not needed while the Organiser plan is on.</p>
                  ) : (
                    <form method="get" action={`/w/${ws}/upgrade/sandbox`} className="flex flex-col gap-3">
                      <input type="hidden" name="plan" value="event" />
                      <SelectField label="Event to upgrade" name="event" defaultValue={buyable[0].id}>
                        {buyable.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                      </SelectField>
                      <button type="submit" className={buttonClass("secondary")}>Try the test upgrade</button>
                    </form>
                  )
                ) : null
              )}
              {p.id === "organiser" && (
                ent.tier === "organiser" ? (
                  <div className="flex flex-col gap-2">
                    <StatusChip tone="info">Current plan (test)</StatusChip>
                    {isOwner && enabled && (
                      <ConfirmAction
                        action={endOrganiser}
                        fields={{ ws }}
                        label="End the test plan"
                        title="End the test Organiser plan?"
                        message="The workspace returns to Free Personal limits. Nothing is charged or refunded because nothing was ever charged. Events and data are kept."
                        confirmLabel="End test plan"
                        tone="secondary"
                      />
                    )}
                  </div>
                ) : isOwner && enabled ? (
                  <ButtonLink href={`/w/${ws}/upgrade/sandbox?plan=organiser`} variant="secondary">Try the test plan</ButtonLink>
                ) : null
              )}
            </div>
          </li>
        ))}
      </ul>
      {!isOwner && <p className="text-sm text-ink-2" data-owner-only>Only workspace owners can change test plans. You can see the current plan and limits.</p>}

      {isOwner && (
        <section aria-labelledby="u-log" className="rounded-lg border border-rule bg-surface p-5">
          <h2 id="u-log" className="text-lg font-bold">Test checkout log</h2>
          {(log ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">No test checkouts yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm" data-log>
                <caption className="sr-only">Recent test checkouts. No card details or money are involved.</caption>
                <thead className="bg-sunken"><tr><th scope="col" className="px-3 py-2">When</th><th scope="col" className="px-3 py-2">Plan</th><th scope="col" className="px-3 py-2">Result</th></tr></thead>
                <tbody>
                  {(log ?? []).map((l) => (
                    <tr key={l.id} className="border-t border-rule" data-outcome={l.outcome}>
                      <td className="num whitespace-nowrap px-3 py-2">{new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                      <td className="px-3 py-2">{l.plan === "event" ? `Event Upgrade${l.event_id ? `: ${titleOf(l.event_id)}` : ""}` : "Organiser"}</td>
                      <td className="px-3 py-2 capitalize">{l.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
