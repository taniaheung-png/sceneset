/** Signature motif: a ticket-stub date block. `date` is a plain YYYY-MM-DD (no timezone shifting). */
export function CueTab({ date, size = "md" }: { date: string; size?: "sm" | "md" }) {
  const d = new Date(`${date}T00:00:00Z`);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(d);
  const big = size === "md";
  return (
    <div
      className={`flex shrink-0 flex-col items-center overflow-hidden rounded-md border border-control bg-surface text-center ${big ? "w-16" : "w-12"}`}
    >
      <span className={`w-full bg-primary font-semibold text-on-primary ${big ? "py-0.5 text-xs" : "text-[0.6875rem] leading-4"}`}>
        {fmt({ month: "short" })}
      </span>
      <span className={`num font-display font-bold leading-none ${big ? "pt-1.5 text-2xl" : "pt-1 text-lg"}`}>{fmt({ day: "numeric" })}</span>
      <span className={`text-ink-2 ${big ? "pb-1 text-xs" : "pb-0.5 text-[0.6875rem]"}`}>{fmt({ weekday: "short" })}</span>
    </div>
  );
}
