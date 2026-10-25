import type { Metadata } from "next";
import Link from "next/link";
import { GuestForm } from "@/components/guests/GuestForm";
import { Banner } from "@/components/site/AuthShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SelectField, TextField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getEvent } from "@/lib/events";
import { RSVPS, guestSummary, rsvpLabel } from "@/lib/guests";
import { createClient } from "@/lib/supabase/server";
import type { GuestRow } from "@/lib/types";
import { deleteGuest, setRsvp } from "./actions";

export const metadata: Metadata = { title: "Guests" };

const MESSAGES: Record<string, [tone: "info" | "danger", text: string]> = {
  "guest-added": ["info", "Guest added."],
  "guest-saved": ["info", "Guest saved."],
  "guest-deleted": ["info", "Guest deleted."],
  "rsvp-saved": ["info", "RSVP updated."],
  forbidden: ["danger", "Your role does not allow that, or it no longer exists. Nothing was changed."],
  invalid: ["danger", "Check the details and try again. Nothing was changed."],
  failed: ["danger", "Something went wrong and nothing was changed. Try again."],
};
const TONE = { invited: "neutral", confirmed: "success", tentative: "warn", declined: "danger" } as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const card = "rounded-lg border border-rule bg-surface p-5";

export default async function Guests({ params, searchParams }: PageProps<"/w/[ws]/events/[ev]/guests">) {
  const { ws, ev } = await params;
  const sp = await searchParams;
  const { event, canManage } = await getEvent(ws, ev);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id, name, contact, group_name, party_size, rsvp, notes, updated_at")
    .eq("event_id", ev)
    .order("name")
    .order("id");
  const all = (data ?? []) as GuestRow[];

  // The summary ALWAYS covers every guest. Filters only narrow the table below it.
  const s = guestSummary(all, event.capacity);
  const q = first(sp.q).trim().slice(0, 80).toLowerCase();
  const fRsvp = RSVPS.some(([k]) => k === first(sp.rsvp)) ? first(sp.rsvp) : "";
  const groups = [...new Set(all.map((g) => g.group_name).filter(Boolean))].sort();
  const fGroup = groups.includes(first(sp.group)) ? first(sp.group) : "";
  const filtering = Boolean(q || fRsvp || fGroup);
  const shown = all.filter(
    (g) => (!q || [g.name, g.group_name, g.contact ?? ""].some((x) => x.toLowerCase().includes(q))) && (!fRsvp || g.rsvp === fRsvp) && (!fGroup || g.group_name === fGroup),
  );
  const shownPeople = shown.reduce((n, g) => n + g.party_size, 0);
  const msg = MESSAGES[first(sp.m)];
  const base = `/w/${ws}/events/${ev}`;
  const hidden = (extra: Record<string, string> = {}) => (
    <>
      <input type="hidden" name="ws" value={ws} />
      <input type="hidden" name="ev" value={ev} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );

  return (
    <>
      {msg && <Banner tone={msg[0]}>{msg[1]}</Banner>}
      {error && <Banner tone="danger">We could not load guests. Refresh to try again.</Banner>}
      {!canManage && <p className="rounded-md bg-sunken p-3 text-sm text-ink-2">You can read the guest list. Organisers and owners edit it.</p>}

      {s.over && s.remaining !== null && (
        <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm font-semibold text-danger">
          Over capacity by {-s.remaining}: {s.attending} people are confirmed for a capacity of {s.capacity}.
        </p>
      )}
      {s.mayExceed && s.capacity !== null && (
        <p role="status" className="rounded-md bg-warn-tint p-3 text-sm font-medium text-warn-ink">
          Within capacity now, but if every tentative guest comes there would be {s.possible} people for a capacity of {s.capacity}.
        </p>
      )}

      <section aria-label="Guest summary (all guests)" className={card}>
        <h2 className="text-lg font-bold">Summary of all guests</h2>
        <p className="mt-1 text-sm text-ink-2">
          A <strong>record</strong> is one entry in the list. A record can be a party of several <strong>people</strong>. Attending headcount counts people on confirmed records only.
        </p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <table className="num w-full text-left text-sm">
            <caption className="sr-only">Guest records and people by RSVP status</caption>
            <thead className="bg-sunken">
              <tr>
                <th scope="col" className="px-3 py-2">RSVP</th>
                <th scope="col" className="px-3 py-2 text-right">Records</th>
                <th scope="col" className="px-3 py-2 text-right">People</th>
              </tr>
            </thead>
            <tbody>
              {RSVPS.map(([k, label]) => (
                <tr key={k} className="border-t border-rule">
                  <th scope="row" className="px-3 py-2 font-normal">{label}</th>
                  <td className="px-3 py-2 text-right">{s.records[k]}</td>
                  <td className="px-3 py-2 text-right">{s.people[k]}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-rule font-semibold">
                <th scope="row" className="px-3 py-2">All guests</th>
                <td className="px-3 py-2 text-right">{s.totalRecords}</td>
                <td className="px-3 py-2 text-right">{s.people.invited + s.people.confirmed + s.people.tentative + s.people.declined}</td>
              </tr>
            </tbody>
          </table>
          <dl className="num grid content-start gap-3 text-sm">
            <div><dt className="text-ink-2">Attending headcount (confirmed people)</dt><dd className="text-3xl font-bold">{s.attending}</dd></div>
            <div><dt className="text-ink-2">Capacity</dt><dd className="text-lg font-bold">{s.capacity === null ? "Not set" : s.capacity}</dd></div>
            <div>
              <dt className="text-ink-2">{s.over ? "Over capacity by" : "Places left"}</dt>
              <dd className={`text-lg font-bold ${s.over ? "text-danger" : ""}`}>{s.remaining === null ? "Not set" : Math.abs(s.remaining)}</dd>
            </div>
            <div><dt className="text-ink-2">Could attend if tentatives come (confirmed + tentative)</dt><dd className="text-lg font-bold">{s.possible}</dd></div>
          </dl>
        </div>
        {s.capacity === null && canManage && (
          <p className="mt-3 text-sm text-ink-2">No capacity is set, so capacity warnings are off. <Link href={`${base}/edit`} className="font-semibold text-primary underline">Set one</Link>.</p>
        )}
      </section>

      <form method="get" role="search" aria-label="Filter guests" className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1"><TextField name="q" type="search" label="Search name, group or contact" defaultValue={q} /></div>
        <SelectField name="rsvp" label="RSVP" defaultValue={fRsvp}>
          <option value="">Any status</option>
          {RSVPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <SelectField name="group" label="Group" defaultValue={fGroup}>
          <option value="">All groups</option>
          {groups.map((x) => <option key={x}>{x}</option>)}
        </SelectField>
        <SubmitButton pendingText="Filtering…">Apply</SubmitButton>
        {filtering && <Link href={`${base}/guests`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary underline">Clear filters</Link>}
      </form>
      {filtering && (
        <p className="text-sm text-ink-2" role="status">
          Showing <span className="num">{shown.length}</span> of <span className="num">{all.length}</span> guest records (<span className="num">{shownPeople}</span> people). The summary above still covers all guests.
        </p>
      )}

      {all.length === 0 ? (
        <section className="max-w-prose rounded-lg border border-rule bg-surface p-6">
          <h2 className="text-lg font-bold">No guests yet</h2>
          <p className="mt-2 text-ink-2">{canManage ? "Add the first guest or party below. Invitations are not sent from SceneSet; this is your planning list." : "An organiser will add guests here."}</p>
        </section>
      ) : shown.length === 0 ? (
        <section className="max-w-prose rounded-lg border border-rule bg-surface p-6">
          <h2 className="text-lg font-bold">No guests match</h2>
          <p className="mt-2 text-ink-2">Nothing fits those filters. Clear them to see the whole list.</p>
          <div className="mt-4"><ButtonLink href={`${base}/guests`} variant="secondary">Clear filters</ButtonLink></div>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <caption className="sr-only">Guest list</caption>
            <thead className="bg-sunken">
              <tr>
                <th scope="col" className="px-3 py-2">Guest</th>
                <th scope="col" className="px-3 py-2">Group</th>
                <th scope="col" className="px-3 py-2 text-right">People</th>
                <th scope="col" className="px-3 py-2">RSVP</th>
                <th scope="col" className="px-3 py-2">Contact</th>
                <th scope="col" className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((g) => (
                <tr key={g.id} className="border-t border-rule align-top" data-guest={g.name}>
                  <th scope="row" className="px-3 py-3 font-semibold">{g.name}{g.notes && <div className="mt-1 text-xs font-normal text-ink-2">{g.notes}</div>}</th>
                  <td className="px-3 py-3">{g.group_name || <span className="text-ink-2">None</span>}</td>
                  <td className="num px-3 py-3 text-right">{g.party_size}</td>
                  <td className="px-3 py-3"><StatusChip tone={TONE[g.rsvp]}>{rsvpLabel(g.rsvp)}</StatusChip></td>
                  <td className="px-3 py-3 text-ink-2">{g.contact || "None"}</td>
                  <td className="px-3 py-3">
                    {canManage && (
                      <div className="flex flex-col items-start gap-2">
                        <form action={setRsvp} className="flex flex-wrap gap-2" aria-label={`Set RSVP for ${g.name}`}>
                          {hidden({ item: g.id })}
                          {RSVPS.filter(([k]) => k !== g.rsvp).map(([k, l]) => (
                            <Button key={k} type="submit" name="rsvp" value={k} variant="secondary">Mark {k === "invited" ? "no reply" : l.toLowerCase()}</Button>
                          ))}
                        </form>
                        <details className="w-full min-w-64 rounded-md border border-rule p-2">
                          <summary className="cursor-pointer text-sm font-semibold">Edit guest</summary>
                          <div className="mt-3">
                            <GuestForm
                              ws={ws} ev={ev} item={g.id} version={g.updated_at} submit="Save guest" notice={false}
                              initial={{ name: g.name, contact: g.contact ?? "", group: g.group_name, party: String(g.party_size), rsvp: g.rsvp, notes: g.notes }}
                            />
                          </div>
                        </details>
                        <ConfirmAction action={deleteGuest} fields={{ ws, ev, item: g.id }} label="Delete" title="Delete this guest?" message={`"${g.name}" will be removed from the list. This cannot be undone.`} confirmLabel="Delete guest" />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <section aria-labelledby="add-guest" className="max-w-3xl rounded-lg border border-rule bg-surface p-5">
          <h2 id="add-guest" className="text-lg font-bold">Add a guest</h2>
          <div className="mt-3"><GuestForm ws={ws} ev={ev} submit="Add guest" /></div>
        </section>
      )}
    </>
  );
}
