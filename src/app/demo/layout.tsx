import type { Metadata } from "next";
import { SideNav } from "@/components/shell/SideNav";
import { demoViews, sample } from "@/lib/sampleData";

export const metadata: Metadata = { title: "Demo preview", robots: { index: false } };

const items = [{ href: "/demo", label: "Dashboard" }, ...demoViews.map((v) => ({ href: `/demo/${v.slug}`, label: v.label }))];

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <SideNav
        items={items}
        eventTitle={sample.event.title}
        note="Read-only preview. Fictional data. You are not signed in."
      />
      <div className="min-w-0 flex-1">
        <p role="note" className="bg-cue px-4 py-2 text-sm font-medium text-ink">
          <strong>Preview, not the working app.</strong> This page shows a static, fictional sample. Nothing here is saved
          and nothing can be edited. Create an account to start a real workspace.
        </p>
        <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
