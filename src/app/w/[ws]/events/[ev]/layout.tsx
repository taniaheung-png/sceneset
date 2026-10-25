import Link from "next/link";
import { EventSwitcher, EventTabs } from "@/components/events/EventNav";
import { Banner } from "@/components/site/AuthShell";
import { CueTab } from "@/components/ui/CueTab";
import { StatusChip } from "@/components/ui/StatusChip";
import { EVENT_STATUSES } from "@/lib/eventOptions";
import { getEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { formatInZone, toLocalInput } from "@/lib/time";

const TONE = { planning: "info", confirmed: "success", done: "neutral" } as const;

export default async function EventLayout({ children, params }: LayoutProps<"/w/[ws]/events/[ev]">) {
  const { ws, ev } = await params;
  const { event, canManage } = await getEvent(ws, ev);
  const supabase = await createClient();
  const { data: others } = await supabase.from("events").select("id, title").eq("workspace_id", ws).is("archived_at", null).order("starts_at");
  const switchable = (others ?? []).some((o) => o.id === ev) ? others! : [{ id: ev, title: event.title }, ...(others ?? [])];

  const tz = event.timezone;
  const fmt = (iso: string) => formatInZone(new Date(iso), tz, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const base = `/w/${ws}/events/${ev}`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <CueTab date={toLocalInput(new Date(event.starts_at), tz).slice(0, 10)} />
          <div>
            <Link href={`/w/${ws}/events`} className="text-sm font-semibold text-primary underline">All events</Link>
            <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>
            <p className="text-sm text-ink-2">
              <span className="num">{fmt(event.starts_at)} to {fmt(event.ends_at)}</span> ({tz})
              {event.venues?.name ? ` at ${event.venues.name}` : ""}
            </p>
            <div className="mt-1 flex gap-2">
              <StatusChip tone={TONE[event.status]}>{EVENT_STATUSES.find(([k]) => k === event.status)?.[1]}</StatusChip>
              {event.archived_at && <StatusChip tone="warn">Archived</StatusChip>}
            </div>
          </div>
        </div>
        <EventSwitcher ws={ws} current={ev} events={switchable} />
      </div>
      {event.archived_at && (
        <Banner tone="info">This event is archived. It is hidden from the events list; show archived events in the list to restore it.</Banner>
      )}
      <EventTabs
        base={base}
        items={[{ slug: "", label: "Dashboard" }, { slug: "tasks", label: "Tasks and notes" }, { slug: "suppliers", label: "Suppliers and quotes" }, { slug: "budget", label: "Budget" }, { slug: "guests", label: "Guests" }, { slug: "schedule", label: "Run of show" }, ...(canManage ? [{ slug: "edit", label: "Edit event" }] : [])]}
      />
      {children}
    </>
  );
}
