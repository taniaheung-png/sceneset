import { RSVPS } from "./guests.ts";

type Getter = { get(name: string): FormDataEntryValue | null };
export type GuestInput = { name: string; contact: string | null; group_name: string; party_size: number; rsvp: string; notes: string };
export type GuestFormResult = { values: Record<string, string>; errors: Record<string, string>; data?: GuestInput };

const FIELDS = ["name", "contact", "group", "party", "rsvp", "notes"];

/** Guest form validation. Pure, so it is unit-tested. Party size is the number of people the record stands for. */
export function parseGuestForm(fd: Getter): GuestFormResult {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(fd.get(k) ?? "").trim()]));
  const errors: Record<string, string> = {};
  const v = values;
  if (v.name.length < 1 || v.name.length > 120) errors.name = "Enter a name of 1 to 120 characters.";
  if (v.contact.length > 200) errors.contact = "Keep the contact detail under 200 characters.";
  if (v.group.length > 60) errors.group = "Keep the group name under 60 characters.";
  if (v.notes.length > 1000) errors.notes = "Keep notes under 1000 characters.";
  if (!RSVPS.some(([k]) => k === v.rsvp)) errors.rsvp = "Choose an RSVP status.";
  const party = v.party === "" ? 1 : /^\d{1,3}$/.test(v.party) ? Number(v.party) : NaN;
  if (!(party >= 1 && party <= 50)) errors.party = "Enter a whole number of people from 1 to 50.";
  if (Object.keys(errors).length) return { values, errors };
  return {
    values,
    errors,
    data: { name: v.name, contact: v.contact || null, group_name: v.group, party_size: party, rsvp: v.rsvp, notes: v.notes },
  };
}
