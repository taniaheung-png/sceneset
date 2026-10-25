import type { Metadata } from "next";
import { LayoutPlanner, type PlannerItem } from "@/components/layout/LayoutPlanner";
import { LayoutLegend, LayoutSvg } from "@/components/layout/LayoutSvg";
import { VenueForm } from "@/components/layout/VenueForm";
import { Banner } from "@/components/site/AuthShell";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SelectField } from "@/components/ui/Field";
import { PrintButton } from "@/components/ui/PrintButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getEvent } from "@/lib/events";
import { cmToMetres, kindLabel } from "@/lib/layout";
import { createClient } from "@/lib/supabase/server";
import type { LayoutItemRow, VenueRow } from "@/lib/types";
import { deleteVenue, setEventVenue } from "./actions";

export const metadata: Metadata = { title: "Venue layout" };

const MESSAGES: Record<string, [tone: "info" | "danger", text: string]> = {
  "layout-saved": ["info", "Layout saved."],
  "venue-set": ["info", "Venue updated for this event."],
  "venue-added": ["info", "Venue added."],
  "venue-saved": ["info", "Venue saved."],
  "venue-deleted": ["info", "Venue deleted. Events that used it were kept; they simply have no venue now."],
  "venue-fit": ["danger", "This event's saved layout objects do not fit in that venue. Move or delete them first, or choose a larger venue. Nothing was changed."],
  forbidden: ["danger", "Your role does not allow that, or it no longer exists. Nothing was changed."],
  invalid: ["danger", "Check the details and try again. Nothing was changed."],
  failed: ["danger", "Something went wrong and nothing was changed. Try again."],
};
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const size = (v: { width_cm: number; depth_cm: number }) => `${cmToMetres(v.width_cm)} m by ${cmToMetres(v.depth_cm)} m`;
const card = "rounded-lg border border-rule bg-surface p-5";

export default async function Layout({ params, searchParams }: PageProps<"/w/[ws]/events/[ev]/layout">) {
  const { ws, ev } = await params;
  const sp = await searchParams;
  const { event, canManage } = await getEvent(ws, ev);
  const supabase = await createClient();
  const [lay, ven, used] = await Promise.all([
    supabase.from("layout_items").select("id, kind, label, x_cm, y_cm, w_cm, h_cm, updated_at").eq("event_id", ev).order("label").order("id"),
    supabase.from("venues").select("id, name, address_note, width_cm, depth_cm, updated_at").eq("workspace_id", ws).order("name"),
    supabase.from("events").select("venue_id").eq("workspace_id", ws).not("venue_id", "is", null),
  ]);
  const items = (lay.data ?? []) as LayoutItemRow[];
  const venues = (ven.data ?? []) as VenueRow[];
  const usedBy = (id: string) => (used.data ?? []).filter((e) => e.venue_id === id).length;
  const venue = venues.find((v) => v.id === event.venue_id) ?? null;
  const msg = MESSAGES[first(sp.m)];
  const room = venue ? { w: venue.width_cm, d: venue.depth_cm } : null;
  const planner: PlannerItem[] = items.map((i) => ({ key: i.id, id: i.id, version: i.updated_at, kind: i.kind, label: i.label, x: i.x_cm, y: i.y_cm, w: i.w_cm, h: i.h_cm }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <p className="text-sm text-ink-2">Plan where tables, the stage, entrances and booths go. Sizes are in metres.</p>
        <PrintButton label="Print the layout" />
      </div>
      {msg && <Banner tone={msg[0]}>{msg[1]}</Banner>}
      {!canManage && <p className="rounded-md bg-sunken p-3 text-sm text-ink-2 no-print">You can read the layout. Organisers and owners edit it.</p>}

      <section aria-labelledby="ev-venue" className={`${card} no-print`}>
        <h2 id="ev-venue" className="text-lg font-bold">Venue for this event</h2>
        {venue ? (
          <p className="mt-1 text-sm"><strong>{venue.name}</strong>, <span className="num">{size(venue)}</span>{venue.address_note && <span className="text-ink-2"> ({venue.address_note})</span>}</p>
        ) : (
          <p className="mt-1 text-sm text-ink-2">
            No venue is set for this event. {items.length > 0 && `${items.length} saved layout object${items.length === 1 ? " is" : "s are"} kept and will reappear when you choose a venue they fit in. `}
            {canManage ? "Choose one below, or add a venue." : "An organiser will choose one."}
          </p>
        )}
        {canManage && (
          <form action={setEventVenue} className="mt-3 flex flex-wrap items-end gap-3" aria-label="Choose the venue for this event">
            <input type="hidden" name="ws" value={ws} />
            <input type="hidden" name="ev" value={ev} />
            <SelectField name="venue" label={venue ? "Change venue" : "Choose a venue"} defaultValue={event.venue_id ?? ""}>
              <option value="">No venue</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name} ({size(v)})</option>)}
            </SelectField>
            <SubmitButton pendingText="Saving…">Use this venue</SubmitButton>
          </form>
        )}
      </section>

      {room && venue && (
        <section aria-labelledby="plan-h" className={card}>
          <h2 id="plan-h" className="text-lg font-bold">Layout: {venue.name}</h2>
          {canManage ? (
            <div className="mt-3">
              <LayoutPlanner key={items.map((i) => i.id + i.updated_at).join()} ws={ws} ev={ev} room={room} venueName={venue.name} initial={planner} />
            </div>
          ) : (
            <div className="mt-3">
              <LayoutSvg room={room} items={items} label={`Layout of ${venue.name}, ${size(venue)}, ${items.length} objects`} />
              <LayoutLegend />
              {items.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <caption className="sr-only">Objects in the layout (metres)</caption>
                    <thead className="bg-sunken"><tr><th scope="col" className="px-3 py-2">Object</th><th scope="col" className="px-3 py-2">Kind</th><th scope="col" className="num px-3 py-2 text-right">X</th><th scope="col" className="num px-3 py-2 text-right">Y</th><th scope="col" className="num px-3 py-2 text-right">Width</th><th scope="col" className="num px-3 py-2 text-right">Depth</th></tr></thead>
                    <tbody>
                      {items.map((i) => (
                        <tr key={i.id} className="border-t border-rule"><th scope="row" className="px-3 py-2 font-semibold">{i.label || kindLabel(i.kind)}</th><td className="px-3 py-2">{kindLabel(i.kind)}</td><td className="num px-3 py-2 text-right">{cmToMetres(i.x_cm)}</td><td className="num px-3 py-2 text-right">{cmToMetres(i.y_cm)}</td><td className="num px-3 py-2 text-right">{cmToMetres(i.w_cm)}</td><td className="num px-3 py-2 text-right">{cmToMetres(i.h_cm)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {items.length === 0 && <p className="mt-3 text-sm text-ink-2">Nothing is placed yet.</p>}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="venues-h" className={`${card} no-print`}>
        <h2 id="venues-h" className="text-lg font-bold">Venues in this workspace</h2>
        <p className="text-sm text-ink-2">Shared by every event. A venue cannot be made smaller than the layout objects placed on it, and deleting one never deletes an event.</p>
        {venues.length === 0 ? (
          <p className="mt-3 text-ink-2">No venues yet. {canManage ? "Add one below." : ""}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-md border border-rule">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Venues</caption>
              <thead className="bg-sunken"><tr><th scope="col" className="px-3 py-2">Venue</th><th scope="col" className="px-3 py-2">Size</th><th scope="col" className="px-3 py-2">Used by</th><th scope="col" className="px-3 py-2">Actions</th></tr></thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id} className="border-t border-rule align-top" data-venue={v.name}>
                    <th scope="row" className="px-3 py-3 font-semibold">{v.name}{v.address_note && <div className="text-xs font-normal text-ink-2">{v.address_note}</div>}</th>
                    <td className="num px-3 py-3">{size(v)}</td>
                    <td className="num px-3 py-3">{usedBy(v.id)} event{usedBy(v.id) === 1 ? "" : "s"}</td>
                    <td className="px-3 py-3">
                      {canManage && (
                        <div className="flex flex-col items-start gap-2">
                          <details className="w-full min-w-64 rounded-md border border-rule p-2">
                            <summary className="cursor-pointer text-sm font-semibold">Edit venue</summary>
                            <div className="mt-3">
                              <VenueForm ws={ws} ev={ev} item={v.id} version={v.updated_at} submit="Save venue" initial={{ name: v.name, note: v.address_note, width: cmToMetres(v.width_cm), depth: cmToMetres(v.depth_cm) }} />
                            </div>
                          </details>
                          <ConfirmAction
                            action={deleteVenue} fields={{ ws, ev, item: v.id }} label="Delete" title="Delete this venue?"
                            message={`${v.name} is used by ${usedBy(v.id)} event${usedBy(v.id) === 1 ? "" : "s"}. They keep all their data and simply lose the venue. Saved layout objects are kept and reappear when a venue they fit in is chosen. This cannot be undone.`}
                            confirmLabel="Delete venue"
                          />
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
          <div className="mt-6 max-w-3xl border-t border-rule pt-4">
            <h3 className="font-semibold">Add a venue</h3>
            <div className="mt-3"><VenueForm ws={ws} ev={ev} submit="Add venue" /></div>
          </div>
        )}
      </section>
    </>
  );
}
