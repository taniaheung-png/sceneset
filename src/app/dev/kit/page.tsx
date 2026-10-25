"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CueTab } from "@/components/ui/CueTab";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";

// Development-only component check (P1.6). Not linked anywhere; 404 in production builds.
export default function Kit() {
  const [open, setOpen] = useState(false);
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main id="main" className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-2xl font-bold">UI kit (dev only)</h1>
      <section aria-labelledby="k-btn" className="flex flex-wrap items-center gap-3">
        <h2 id="k-btn" className="w-full text-lg font-semibold">Buttons</h2>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Delete</Button>
        <Button disabled>Disabled</Button>
        <ButtonLink href="/">Link button</ButtonLink>
      </section>
      <section aria-labelledby="k-form" className="grid gap-4 sm:grid-cols-2">
        <h2 id="k-form" className="text-lg font-semibold sm:col-span-2">Fields</h2>
        <TextField label="Event title" hint="Shown on the dashboard and printout." placeholder="Harbour Night Market" />
        <TextField label="Budget target" error="Enter an amount of 0 or more." defaultValue="-5" />
        <SelectField label="Status">
          <option>Planning</option>
          <option>Confirmed</option>
        </SelectField>
      </section>
      <section aria-labelledby="k-chip" className="flex flex-wrap items-center gap-3">
        <h2 id="k-chip" className="w-full text-lg font-semibold">Status chips and cue tabs</h2>
        <StatusChip>Draft</StatusChip>
        <StatusChip tone="info">In progress</StatusChip>
        <StatusChip tone="success">Done</StatusChip>
        <StatusChip tone="warn">Due soon</StatusChip>
        <StatusChip tone="danger">Over budget</StatusChip>
        <CueTab date="2026-11-14" />
        <CueTab date="2026-12-02" size="sm" />
      </section>
      <section aria-labelledby="k-dlg">
        <h2 id="k-dlg" className="mb-3 text-lg font-semibold">Dialog</h2>
        <Button variant="secondary" onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Archive this event?">
          <p>Archived events are hidden from the list but keep all their data.</p>
        </Dialog>
      </section>
    </main>
  );
}
