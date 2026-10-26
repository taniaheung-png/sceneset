/** The date tile (month over day), as in the reference's event rows. `date` is a plain YYYY-MM-DD (no timezone shifting). */
export function CueTab({ date, tone = "blue" }: { date: string; size?: "sm" | "md"; tone?: "blue" | "coral" }) {
  const d = new Date(`${date}T00:00:00Z`);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(d);
  return (
    <div className={`date-tile ${tone === "coral" ? "date-tile-coral" : ""}`} aria-label={fmt({ weekday: "long", day: "numeric", month: "long" })} role="img">
      <span className="d num">{fmt({ day: "numeric" })}</span>
      <span className="m">{fmt({ month: "short" })}</span>
    </div>
  );
}
