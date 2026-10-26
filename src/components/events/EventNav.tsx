"use client";

import { usePathname, useRouter } from "next/navigation";

const select =
  "min-h-11 w-full rounded-[0.4375rem] border border-control bg-surface px-3 text-sm text-ink";

/** Jump to another event in the same workspace while staying on the same section (tasks stays tasks). */
export function EventSwitcher({ ws, current, events }: { ws: string; current: string; events: { id: string; title: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  if (events.length < 2) return null;
  const section = pathname.split(`/events/${current}`)[1] ?? "";
  return (
    <div className="no-print flex flex-col gap-1 text-[0.8125rem]">
      <label htmlFor="event-switch" className="sr-only">Switch event</label>
      <select
        id="event-switch"
        value={current}
        onChange={(e) => router.push(`/w/${ws}/events/${e.target.value}${section === "/edit" ? "" : section}`)}
        className={select}
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
    <div className="flex flex-col gap-1 text-[0.8125rem]">
      <label htmlFor="ws-switch" className="sr-only">Switch workspace</label>
      <select
        id="ws-switch"
        value={current}
        onChange={(e) => router.push(`/w/${e.target.value}/events`)}
        className={select}
      >
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </div>
  );
}
