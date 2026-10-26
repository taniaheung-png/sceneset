"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EventSwitcher } from "@/components/events/EventNav";
import { Brand } from "@/components/site/Brand";
import {
  BriefcaseIcon, CalendarIcon, CardIcon, CheckCircleIcon, ClockIcon, GridIcon, LayoutIcon, MenuIcon, PencilIcon, PrinterIcon, SettingsIcon, UsersIcon, WalletIcon,
} from "@/components/ui/icons";

const ICONS = {
  grid: GridIcon, calendar: CalendarIcon, tasks: CheckCircleIcon, wallet: WalletIcon, suppliers: BriefcaseIcon, guests: UsersIcon, clock: ClockIcon,
  layout: LayoutIcon, print: PrinterIcon, edit: PencilIcon, settings: SettingsIcon, plan: CardIcon,
} as const;
export type IconKey = keyof typeof ICONS;

export type NavItem = { href: string; label: string; icon: IconKey; /** also current on these paths */ also?: string[] };
export type NavGroup = { label: string; items: NavItem[] };
/** Event views: shown (with the event's own base path) whenever the URL is inside `${prefix}/<event id>`. */
export type EventNav = { prefix: string; ws: string; label: string; items: { slug: string; label: string; icon: IconKey }[]; events: { id: string; title: string }[] };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * The application frame from the reference design: a fixed 248 px sidebar (brand, grouped navigation with icons, plan card, profile row),
 * a 66 px top bar with breadcrumbs, and a centred content column. Below 821 px the sidebar is a drawer opened from the top bar.
 * Everything here is navigation only; pages keep their own data and actions.
 */
export function AppShell({
  groups, eventNav, root, profile, planCard, switcher, signOut, tagline = true, brandHref = "/app", topbarRight, children,
}: {
  groups: NavGroup[];
  eventNav?: EventNav;
  root: string;
  profile: { initials: string; name: string; sub: string };
  planCard?: React.ReactNode;
  switcher?: React.ReactNode;
  signOut?: React.ReactNode;
  tagline?: boolean;
  brandHref?: string;
  topbarRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const eventBase = eventNav ? new RegExp(`^${eventNav.prefix.replace(/[/.]/g, "\\$&")}/(${UUID})`, "i").exec(pathname)?.[0] : undefined;
  const eventItems: NavItem[] = eventNav && eventBase ? eventNav.items.map((i) => ({ href: i.slug ? `${eventBase}/${i.slug}` : eventBase, label: i.label, icon: i.icon })) : [];
  const all = [...groups.flatMap((g) => g.items), ...eventItems];
  const isCurrent = (i: NavItem) => pathname === i.href || (i.also ?? []).includes(pathname);
  const current = all.find(isCurrent);
  const tail: [string, string][] = [["/events/new", "New event"], ["/sandbox", "Test checkout"], ["/summary", "Print summary"], ["/edit", "Edit event"]];
  const view = current?.label ?? tail.find(([t]) => pathname.endsWith(t))?.[1] ?? "";
  const eventId = eventBase?.split("/").pop();

  const link = (i: NavItem) => {
    const Icon = ICONS[i.icon];
    const on = isCurrent(i);
    return (
      <li key={i.href}>
        <Link
          href={i.href}
          aria-current={on ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={`flex min-h-11 items-center gap-3 rounded-[0.5625rem] px-3 text-sm transition duration-150 ${on ? "bg-primary-tint font-bold text-navy" : "font-medium text-ink-2 hover:translate-x-0.5 hover:bg-paper hover:text-navy"}`}
        >
          <Icon width={18} height={18} className="shrink-0" />
          {i.label}
        </Link>
      </li>
    );
  };
  const labelClass = "mb-2 mt-1 truncate px-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-2";

  return (
    <div className="min-h-screen">
      <aside
        id="app-nav"
        data-open={open}
        className="no-print fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-w)] flex-col border-r border-rule bg-surface px-4 pb-4 pt-7 transition-[transform,visibility] duration-200 max-[820px]:invisible max-[820px]:-translate-x-[101%] max-[820px]:shadow-[12px_0_36px_rgb(25_39_49/0.09)] max-[820px]:data-[open=true]:visible max-[820px]:data-[open=true]:translate-x-0"
      >
        <div className="mb-8 px-2">
          <Brand tagline={tagline} href={brandHref} />
        </div>
        <nav aria-label="Workspace" className="flex-1 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.label} className="mb-4">
              <p className={labelClass}>{g.label}</p>
              <ul className="flex flex-col gap-1">{g.items.map(link)}</ul>
            </div>
          ))}
          {eventNav && eventItems.length > 0 && (
            <div className="mb-4 border-t border-rule pt-4">
              <p className={labelClass}>{eventNav.label}</p>
              {eventId && eventNav.events.length > 1 && (
                <div className="mb-2 px-1"><EventSwitcher ws={eventNav.ws} current={eventId} events={eventNav.events.some((e) => e.id === eventId) ? eventNav.events : [{ id: eventId, title: "This event" }, ...eventNav.events]} /></div>
              )}
              <ul className="flex flex-col gap-1">{eventItems.map(link)}</ul>
            </div>
          )}
        </nav>
        <div className="mt-3 flex flex-col gap-3">
          {switcher}
          {planCard}
          <div className="flex items-center gap-2.5 border-t border-rule pt-4">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-soft text-xs font-bold text-navy">{profile.initials}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.8125rem] font-bold text-navy">{profile.name}</span>
              <span className="block truncate text-xs text-ink-2">{profile.sub}</span>
            </span>
            {signOut}
          </div>
        </div>
      </aside>

      {open && <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="no-print fixed inset-0 z-20 bg-ink/25 min-[821px]:hidden" />}

      <div className="shell-main flex min-h-screen flex-col min-[821px]:ml-[var(--sidebar-w)]">
        <header className="no-print flex h-[3.6875rem] items-center justify-between gap-3 border-b border-rule bg-surface/70 px-[15px] min-[641px]:px-[22px] min-[1121px]:px-[42px]">
          <div className="flex min-w-0 items-center gap-2">
            <button
              ref={button}
              type="button"
              aria-expanded={open}
              aria-controls="app-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
              className="-ml-2 grid size-11 place-items-center rounded-[0.5625rem] text-ink-2 hover:bg-sunken hover:text-navy min-[821px]:hidden"
            >
              <MenuIcon />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0 text-[0.8125rem] text-ink-2">
              <ol className="flex min-w-0 items-center gap-2">
                <li className="truncate">{root}</li>
                {view && (
                  <>
                    <li aria-hidden className="text-rule">/</li>
                    <li aria-current="page" className="truncate font-bold text-navy">{view}</li>
                  </>
                )}
              </ol>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-ink-2">
            {topbarRight}
            <span aria-hidden className="grid size-8 place-items-center rounded-full bg-coral-soft text-[0.6875rem] font-bold text-coral-dark">{profile.initials}</span>
          </div>
        </header>
        <main id="main" className="mx-auto flex w-full max-w-[1210px] flex-1 flex-col gap-6 px-[15px] pb-8 pt-6 min-[641px]:px-[22px] min-[821px]:pt-8 min-[1121px]:px-[42px]">
          {children}
        </main>
      </div>
    </div>
  );
}
