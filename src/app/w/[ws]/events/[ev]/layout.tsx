import { Banner } from "@/components/site/AuthShell";
import { ButtonLink } from "@/components/ui/Button";
import { CueTab } from "@/components/ui/CueTab";
import { PencilIcon, PrinterIcon } from "@/components/ui/icons";
import { StatusChip } from "@/components/ui/StatusChip";
import { EVENT_STATUSES } from "@/lib/eventOptions";
import { getEvent } from "@/lib/events";
import { formatInZone, toLocalInput } from "@/lib/time";

const TONE = { planning: "info", confirmed: "success", done: "neutral" } as const;

export default async function EventLayout({ children, params }: LayoutProps<"/w/[ws]/events/[ev]">) {
  const { ws, ev } = await params;
  const { event, canManage } = await getEvent(ws, ev);

  const tz = event.timezone;
  const fmt = (iso: string) => formatInZone(new Date(iso), tz, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const base = `/w/${ws}/events/${ev}`;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <CueTab date={toLocalInput(new Date(event.starts_at), tz).slice(0, 10)} />
          <div className="min-w-0">
            <p className="eyebrow">{event.type === "other" ? "Event" : event.type}</p>
            <h1 className="page-title">{event.title}</h1>
            <p className="page-intro">
              <span className="num">{fmt(event.starts_at)} to {fmt(event.ends_at)}</span> ({tz})
              {event.venues?.name ? ` at ${event.venues.name}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusChip tone={TONE[event.status]}>{EVENT_STATUSES.find(([k]) => k === event.status)?.[1]}</StatusChip>
              {event.archived_at && <StatusChip tone="warn">Archived</StatusChip>}
            </div>
          </div>
        </div>
        <div className="no-print flex flex-wrap items-center gap-3">
          {canManage && (
            <ButtonLink href={`${base}/edit`} variant="secondary"><PencilIcon width={16} height={16} />Edit event</ButtonLink>
          )}
          <ButtonLink href={`${base}/summary`}><PrinterIcon width={16} height={16} />Print summary</ButtonLink>
        </div>
      </header>
      {event.archived_at && (
        <Banner tone="info">This event is archived. It is hidden from the events list; show archived events in the list to restore it.</Banner>
      )}
      {children}
    </>
  );
}
