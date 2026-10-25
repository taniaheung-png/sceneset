"use client";

import { Button } from "./Button";

/** Opens the browser's print dialog. Print CSS hides navigation and controls. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" className="no-print" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
