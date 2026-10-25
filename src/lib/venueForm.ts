import { metresToCm } from "./layout.ts";

type Getter = { get(name: string): FormDataEntryValue | null };
export type VenueInput = { name: string; address_note: string; width_cm: number; depth_cm: number };
export type VenueFormResult = { values: Record<string, string>; errors: Record<string, string>; data?: VenueInput };

const FIELDS = ["name", "note", "width", "depth"];
const MIN_CM = 100; // 1 m: smaller than any room worth planning
const MAX_CM = 100_000; // 1 km

/** Venue form. Width and depth are typed in metres (up to 2 decimals) and stored as whole centimetres. */
export function parseVenueForm(fd: Getter): VenueFormResult {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(fd.get(k) ?? "").trim()]));
  const errors: Record<string, string> = {};
  const v = values;
  if (v.name.length < 1 || v.name.length > 120) errors.name = "Enter a name of 1 to 120 characters.";
  if (v.note.length > 300) errors.note = "Keep the note under 300 characters.";
  const dim = (raw: string, key: string, label: string) => {
    const cm = metresToCm(raw);
    if (cm === null || cm < MIN_CM || cm > MAX_CM) {
      errors[key] = `${label}: enter metres from 1 to 1000, with at most 2 decimals.`;
      return 0;
    }
    return cm;
  };
  const width_cm = dim(v.width, "width", "Width");
  const depth_cm = dim(v.depth, "depth", "Depth");
  if (Object.keys(errors).length) return { values, errors };
  return { values, errors, data: { name: v.name, address_note: v.note, width_cm, depth_cm } };
}
