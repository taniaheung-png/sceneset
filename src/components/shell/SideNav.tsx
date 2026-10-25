"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

/** `prefix`: also highlight for nested pages (e.g. Events while inside an event). */
export type NavItem = { href: string; label: string; prefix?: boolean };

/** Desktop: fixed sidebar. Below 1024px: top bar with a disclosure button (Escape closes it). */
export function SideNav({
  items,
  eventTitle,
  label = "Current event",
  note,
  footer,
}: {
  items: NavItem[];
  eventTitle: string;
  label?: string;
  note?: string;
  footer?: React.ReactNode;
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

  return (
    <div className="lg:sticky lg:top-0 lg:h-screen lg:w-[var(--sidebar-w)] lg:shrink-0">
      <div className="flex items-center justify-between border-b border-rule bg-surface px-4 py-2 lg:hidden">
        <Link href="/" className="font-display text-lg font-bold">SceneSet</Link>
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls="app-nav"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-sunken"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
          {open ? "Close menu" : "Menu"}
        </button>
      </div>

      <aside
        id="app-nav"
        className={`${open ? "flex" : "hidden"} flex-col gap-5 border-b border-rule bg-surface p-4 lg:flex lg:h-full lg:border-b-0 lg:border-r`}
      >
        <Link href="/" className="hidden font-display text-xl font-bold lg:block">SceneSet</Link>
        <div className="rounded-md bg-sunken p-3">
          <p className="text-xs text-ink-2">{label}</p>
          <p className="font-semibold leading-snug">{eventTitle}</p>
        </div>
        <nav aria-label="Event">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const current = pathname === item.href || (item.prefix === true && pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${current ? "bg-primary-tint text-primary" : "text-ink hover:bg-sunken"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col gap-2 text-xs text-ink-2">
          {note && <p>{note}</p>}
          {footer}
        </div>
      </aside>
    </div>
  );
}

