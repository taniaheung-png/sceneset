import type { Metadata } from "next";
import Link from "next/link";
import { SideNav } from "@/components/shell/SideNav";
import { demoViews } from "@/lib/sampleData";

export const metadata: Metadata = { title: "Demo", robots: { index: false } };

const items = [{ href: "/demo", label: "Dashboard" }, ...demoViews.map((v) => ({ href: `/demo/${v.slug}`, label: v.label }))];

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <SideNav
        items={items}
        eventTitle="Harbour Night Market (sample)"
        note="Read-only demo with fictional data. You are not signed in."
      />
      <div className="min-w-0 flex-1">
        <p role="note" className="no-print bg-cue px-4 py-2 text-sm font-medium text-ink">
          <strong>Read-only demo.</strong> Everything here is fictional and nothing can be edited or saved.{" "}
          <Link href="/signup" className="font-semibold underline">Create an account</Link> to plan a real event, then load this sample into your own workspace.
        </p>
        <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
