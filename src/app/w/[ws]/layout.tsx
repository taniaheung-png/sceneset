import Link from "next/link";
import { signOut } from "@/app/(site)/auth-actions";
import { WorkspaceSwitcher } from "@/components/events/EventNav";
import { AppShell, type EventNav, type NavGroup } from "@/components/shell/AppShell";
import { SignOutIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[ws]">) {
  const { ws } = await params;
  const { user, workspace, role } = await getWorkspace(ws);
  const supabase = await createClient();
  const [{ data: mine }, { data: profile }, { data: evs }] = await Promise.all([
    supabase.from("workspaces").select("id, name").order("created_at"),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("events").select("id, title").eq("workspace_id", ws).is("archived_at", null).order("starts_at"),
  ]);
  const name = profile?.display_name?.trim() || user.email.split("@")[0] || "You";

  const groups: NavGroup[] = [
    {
      label: workspace.name,
      items: [
        { href: `/w/${ws}/events`, label: "Events", icon: "calendar", also: [`/w/${ws}/events/new`] },
        { href: `/w/${ws}/upgrade`, label: "Plan", icon: "plan", also: [`/w/${ws}/upgrade/sandbox`] },
        { href: `/w/${ws}/settings`, label: "Settings", icon: "settings" },
      ],
    },
  ];
  const eventNav: EventNav = {
    prefix: `/w/${ws}/events`,
    ws,
    events: evs ?? [],
    label: "This event",
    items: [
      { slug: "", label: "Dashboard", icon: "grid" },
      { slug: "tasks", label: "Tasks and notes", icon: "tasks" },
      { slug: "suppliers", label: "Suppliers and quotes", icon: "suppliers" },
      { slug: "budget", label: "Budget", icon: "wallet" },
      { slug: "guests", label: "Guests", icon: "guests" },
      { slug: "schedule", label: "Run of show", icon: "clock" },
      { slug: "layout", label: "Venue layout", icon: "layout" },
    ],
  };

  return (
    <AppShell
      groups={groups}
      eventNav={eventNav}
      root={workspace.name}
      profile={{ initials: name.slice(0, 2).toUpperCase(), name, sub: `${role[0].toUpperCase()}${role.slice(1)} · ${user.email}` }}
      switcher={<WorkspaceSwitcher current={ws} workspaces={mine ?? []} />}
      planCard={
        <Link href={`/w/${ws}/upgrade`} className="row-card block px-3.5 py-3 text-xs text-ink-2 hover:border-control">
          <span className="block font-bold text-navy">{workspace.plan === "organiser" ? "Organiser (test)" : "Free Personal"}</span>
          <span className="mt-0.5 block">Plan and limits</span>
        </Link>
      }
      signOut={
        <form action={signOut}>
          <button type="submit" aria-label="Sign out" title="Sign out" className="grid size-11 place-items-center rounded-[0.5625rem] text-ink-2 hover:bg-sunken hover:text-navy">
            <SignOutIcon width={18} height={18} />
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
