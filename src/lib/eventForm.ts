import { CURRENCIES, EVENT_STATUSES, EVENT_TYPES, TIMEZONES } from "./eventOptions.ts";
import { parseMajorToMinor } from "./money.ts";
import { zonedLocalToInstant } from "./time.ts";

export type EventFormResult = {
  /** Raw submitted values, handed back to repopulate the form after an error. */
  values: Record<string, string>;
  errors: Record<string, string>;
  data?: {
    title: string; type: string; goals: string; starts_at: string; ends_at: string; timezone: string;
    currency: string; capacity: number | null; budget_target_minor: number; status: string; venue_id: string | null;
  };
  newVenue?: { name: string; width_cm: number; depth_cm: number };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ["title", "type", "goals", "start", "end", "timezone", "currency", "capacity", "budget", "status", "venue", "venueName", "venueWidth", "venueDepth"];

/** Validates the event form on the server. Pure (no I/O) so it is unit-tested. Dimensions are entered in metres. */
export function parseEventForm(fd: { get(name: string): FormDataEntryValue | null }): EventFormResult {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(fd.get(k) ?? "").trim()]));
  const errors: Record<string, string> = {};
  const v = values;

  if (v.title.length < 1 || v.title.length > 120) errors.title = "Enter a title of 1 to 120 characters.";
  if (!(EVENT_TYPES as readonly string[]).includes(v.type)) errors.type = "Choose an event type.";
  if (v.goals.length > 2000) errors.goals = "Keep goals under 2000 characters.";
  if (!(TIMEZONES as readonly string[]).includes(v.timezone)) errors.timezone = "Choose a timezone from the list.";
  if (!(CURRENCIES as readonly string[]).includes(v.currency)) errors.currency = "Choose a currency.";
  if (!EVENT_STATUSES.some(([k]) => k === v.status)) errors.status = "Choose a status.";

  const start = errors.timezone ? null : zonedLocalToInstant(v.start, v.timezone);
  const end = errors.timezone ? null : zonedLocalToInstant(v.end, v.timezone);
  if (!errors.timezone && !start) errors.start = "Enter a valid start date and time.";
  if (!errors.timezone && !end) errors.end = "Enter a valid end date and time.";
  if (start && end && end <= start) errors.end = "The end must be after the start.";

  let capacity: number | null = null;
  if (v.capacity !== "") {
    capacity = /^\d{1,7}$/.test(v.capacity) ? Number(v.capacity) : NaN;
    if (Number.isNaN(capacity)) errors.capacity = "Enter a whole number of 0 or more, or leave it blank.";
  }
  let budget = 0;
  if (v.budget !== "") {
    const m = parseMajorToMinor(v.budget);
    if (m === null) errors.budget = "Enter an amount like 80000 or 1,250.50 (no negatives, at most 2 decimals).";
    else budget = m;
  }

  let venue_id: string | null = null;
  let newVenue: EventFormResult["newVenue"];
  if (v.venueName) {
    const w = Number(v.venueWidth), d = Number(v.venueDepth);
    if (v.venueName.length > 120) errors.venueName = "Keep the venue name under 120 characters.";
    else if (!(w > 0 && d > 0 && w <= 10000 && d <= 10000)) errors.venueWidth = "Enter the venue width and depth in metres (more than 0).";
    else newVenue = { name: v.venueName, width_cm: Math.round(w * 100), depth_cm: Math.round(d * 100) };
  } else if (v.venue) {
    if (UUID.test(v.venue)) venue_id = v.venue;
    else errors.venue = "Choose a venue from the list.";
  }

  if (Object.keys(errors).length) return { values, errors };
  return {
    values,
    errors,
    newVenue,
    data: {
      title: v.title, type: v.type, goals: v.goals, starts_at: start!.toISOString(), ends_at: end!.toISOString(),
      timezone: v.timezone, currency: v.currency, capacity, budget_target_minor: budget, status: v.status, venue_id,
    },
  };
}
