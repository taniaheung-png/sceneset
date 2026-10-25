// Instants are stored as UTC timestamps; each event has an IANA timezone used only for display and input.

const partsIn = (date: Date, tz: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, ms: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) };
};

/**
 * Converts a wall-clock "YYYY-MM-DDTHH:mm" in an IANA timezone to the real instant. Null if input or zone is invalid.
 * shortcut: for a clock time skipped or repeated by a DST change this picks one valid instant without warning; add a check if it matters.
 */
export function zonedLocalToInstant(local: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (Number.isNaN(asUtc) || new Date(asUtc).getUTCDate() !== +m[3]) return null; // e.g. 31 February
  try {
    let guess = asUtc - (partsIn(new Date(asUtc), tz).ms - asUtc);
    guess = asUtc - (partsIn(new Date(guess), tz).ms - guess); // second pass settles DST edges
    return new Date(guess);
  } catch {
    return null; // unknown timezone
  }
}

/** The reverse of zonedLocalToInstant: an instant as "YYYY-MM-DDTHH:mm" wall-clock time in the zone (for datetime-local inputs). */
export function toLocalInput(date: Date, tz: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Today's calendar date (YYYY-MM-DD) in the zone: used for "overdue" so it follows the event, not the server clock zone. */
export const todayIn = (tz: string, now: Date = new Date()): string => partsIn(now, tz).date;

export function formatInZone(date: Date, tz: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...options }).format(date);
}

/** True when the activity ends on a later local calendar day than it starts (e.g. 23:00 to 01:00). */
export function crossesMidnight(start: Date, end: Date, tz: string): boolean {
  return end > start && partsIn(end, tz).date > partsIn(start, tz).date;
}
