"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";

/** Disables itself while its form is submitting, so a double click cannot submit twice. */
export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
