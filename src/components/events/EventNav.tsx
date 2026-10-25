"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function EventTabs({ base, items }: { base: string; items: { slug: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Event sections" className="-mb-px flex flex-wrap gap-1 border-b border-rule">
      {items.map(({ slug, label }) => {
        const href = slug ? `${base}/${slug}` : base;
        const current = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold ${current ? "border-primary text-primary" : "border-transparent text-ink hover:bg-sunken"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Jump to another event in the same workspace while staying on the same section (tasks stays tasks). */
export function EventSwitcher({ ws, current, events }: { ws: string; current: string; events: { id: string; title: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  if (events.length < 2) return null;
  const section = pathname.split(`/events/${current}`)[1] ?? "";
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="event-switch" className="font-semibold">Switch event</label>
      <select
        id="event-switch"
        value={current}
        onChange={(e) => router.push(`/w/${ws}/events/${e.target.value}${section === "/edit" ? "" : section}`)}
        className="min-h-11 max-w-56 rounded-md border border-control bg-surface px-3"
      >
        {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>
    </div>
  );
}

/** Only shown to people who belong to more than one workspace. */
export function WorkspaceSwitcher({ current, workspaces }: { current: string; workspaces: { id: string; name: string }[] }) {
  const router = useRouter();
  if (workspaces.length < 2) return null;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor="ws-switch" className="font-semibold">Switch workspace</label>
      <select
        id="ws-switch"
        value={current}
        onChange={(e) => router.push(`/w/${e.target.value}/events`)}
        className="min-h-11 rounded-md border border-control bg-surface px-3"
      >
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </div>
  );
}
