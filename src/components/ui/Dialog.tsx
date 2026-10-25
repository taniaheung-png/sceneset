"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

/**
 * Native <dialog>: the browser provides the focus trap, Escape-to-close and focus
 * restore to the opening control. We only sync the `open` prop and render a close button.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg bg-surface p-6 text-ink shadow-2 backdrop:bg-ink/50"
    >
      <h2 id={titleId} className="text-xl font-bold">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </dialog>
  );
}
