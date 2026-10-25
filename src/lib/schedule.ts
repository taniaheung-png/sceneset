import { zonedLocalToInstant } from "./time.ts";

export type Entry = { id: string; title: string; starts_at: string; ends_at: string; owner_id: string | null };

/** Deterministic running order: start, then end, then id (so equal times never shuffle between page loads). */
export function sortEntries<T extends Entry>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
      Date.parse(a.ends_at) - Date.parse(b.ends_at) ||
      a.id.localeCompare(b.id),
  );
}

export type Warning = {
  kind: "before-window" | "after-window" | "parallel" | "owner-clash";
  text: string;
};

/**
 * Non-blocking warnings per entry. Parallel activities are legitimate, so a plain overlap is only informational;
 * the same person responsible for two overlapping entries is the one worth a real warning. Back-to-back is not an overlap.
 * shortcut: compares every pair (O(n^2)); fine for a running order of a few hundred entries, index by time beyond that.
 */
export function entryWarnings(list: Entry[], windowStart: string, windowEnd: string): Map<string, Warning[]> {
  const sorted = sortEntries(list);
  const out = new Map<string, Warning[]>(sorted.map((e) => [e.id, []]));
  const ws = Date.parse(windowStart);
  const we = Date.parse(windowEnd);
  for (const e of sorted) {
    if (Date.parse(e.starts_at) < ws) out.get(e.id)!.push({ kind: "before-window", text: "Starts before the event starts" });
    if (Date.parse(e.ends_at) > we) out.get(e.id)!.push({ kind: "after-window", text: "Ends after the event ends" });
  }
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (Date.parse(b.starts_at) >= Date.parse(a.ends_at)) break; // sorted by start: nothing later can overlap `a`
      const clash = a.owner_id !== null && a.owner_id === b.owner_id;
      out.get(a.id)!.push(clash ? { kind: "owner-clash", text: `Same person is responsible for "${b.title}", which overlaps` } : { kind: "parallel", text: `Runs in parallel with "${b.title}"` });
      out.get(b.id)!.push(clash ? { kind: "owner-clash", text: `Same person is responsible for "${a.title}", which overlaps` } : { kind: "parallel", text: `Runs in parallel with "${a.title}"` });
    }
  }
  return out;
}

type Getter = { get(name: string): FormDataEntryValue | null };
export type EntryInput = { title: string; starts_at: string; ends_at: string; location: string; owner_id: string | null; notes: string };
export type EntryFormResult = { values: Record<string, string>; errors: Record<string, string>; data?: EntryInput };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ["title", "start", "end", "owner", "location", "notes"];

/** Entry form validation. Times are wall-clock times in the EVENT's timezone; an end earlier than the start is rejected. */
export function parseEntryForm(fd: Getter, timezone: string): EntryFormResult {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(fd.get(k) ?? "").trim()]));
  const errors: Record<string, string> = {};
  const v = values;
  if (v.title.length < 1 || v.title.length > 200) errors.title = "Enter an activity of 1 to 200 characters.";
  if (v.location.length > 120) errors.location = "Keep the location under 120 characters.";
  if (v.notes.length > 2000) errors.notes = "Keep notes under 2000 characters.";
  if (v.owner && !UUID.test(v.owner)) errors.owner = "Choose a person from the list.";
  const start = zonedLocalToInstant(v.start, timezone);
  const end = zonedLocalToInstant(v.end, timezone);
  if (!start) errors.start = "Enter a valid start date and time.";
  if (!end) errors.end = "Enter a valid end date and time.";
  if (start && end && end <= start) errors.end = "The end must be after the start. For an overnight activity, set the end to the next day.";
  if (Object.keys(errors).length) return { values, errors };
  return {
    values,
    errors,
    data: { title: v.title, starts_at: start!.toISOString(), ends_at: end!.toISOString(), location: v.location, owner_id: v.owner || null, notes: v.notes },
  };
}
