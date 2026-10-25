"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { SubmitButton } from "./SubmitButton";

/** A destructive action that needs an explicit second step. The server action runs only from the dialog's form. */
export function ConfirmAction({
  action,
  fields,
  label,
  title,
  message,
  confirmLabel,
  tone = "danger",
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  /** "danger" for irreversible actions (red confirm button); "secondary" for reversible ones such as archive. */
  tone?: "danger" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <p>{message}</p>
        <form action={action} className="mt-4">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <SubmitButton variant={tone} pendingText="Working…">{confirmLabel}</SubmitButton>
        </form>
      </Dialog>
    </>
  );
}
