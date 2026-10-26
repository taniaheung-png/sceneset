import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { demoViews } from "@/lib/sampleData";

export const metadata: Metadata = { title: "Demo", robots: { index: false } };

const ICON = { tasks: "tasks", budget: "wallet", suppliers: "suppliers", guests: "guests", schedule: "clock", layout: "layout", summary: "print" } as const;

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const groups = [
    {
      label: "Harbour Night Market (sample)",
      items: [
        { href: "/demo", label: "Dashboard", icon: "grid" as const },
        ...demoViews.map((v) => ({ href: `/demo/${v.slug}`, label: v.label, icon: ICON[v.slug as keyof typeof ICON] ?? ("grid" as const) })),
      ],
    },
  ];
  return (
    <AppShell
      groups={groups}
      root="Demo"
      profile={{ initials: "DM", name: "Read-only demo", sub: "Fictional data, not signed in" }}
      brandHref="/"
      planCard={
        <Link href="/signup" className="row-card block px-3.5 py-3 text-xs text-ink-2 hover:border-control">
          <span className="block font-bold text-navy">Plan a real event</span>
          <span className="mt-0.5 block">Create an account, then load this sample into your own workspace.</span>
        </Link>
      }
    >
      <p role="note" className="no-print rounded-[0.5625rem] bg-gold-soft px-4 py-2.5 text-[0.8125rem] font-medium text-ink">
        <strong>Read-only demo.</strong> Everything here is fictional and nothing can be edited or saved.{" "}
        <Link href="/signup" className="font-semibold underline">Create an account</Link> to plan a real event, then load this sample into your own workspace.
      </p>
      {children}
    </AppShell>
  );
}
