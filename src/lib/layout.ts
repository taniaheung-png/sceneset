// Venue layout geometry. Everything is whole centimetres; the venue is a W x D rectangle with its origin at the top-left.
// The database enforces the same bounds (trigger on layout_items), so this module is for instant feedback and keyboard moves.

export type Box = { x: number; y: number; w: number; h: number };
export type Room = { w: number; d: number };
export const MIN_SIZE = 10; // cm: nothing smaller than 10 cm, so objects never vanish

export const KINDS = [
  ["table", "Table", 150, 150],
  ["stage", "Stage", 600, 300],
  ["entrance", "Entrance", 200, 50],
  ["booth", "Booth", 300, 200],
  ["other", "Other", 100, 100],
] as const;
export type Kind = (typeof KINDS)[number][0];
export const kindLabel = (k: string) => KINDS.find(([x]) => x === k)?.[1] ?? k;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export function fits(b: Box, room: Room): boolean {
  return b.w >= MIN_SIZE && b.h >= MIN_SIZE && b.x >= 0 && b.y >= 0 && b.x + b.w <= room.w && b.y + b.h <= room.d;
}

/** The nearest box that fits: size first (never larger than the room, never below the minimum), then position. */
export function clampBox(b: Box, room: Room): Box {
  const w = clamp(Math.round(b.w), MIN_SIZE, Math.max(MIN_SIZE, room.w));
  const h = clamp(Math.round(b.h), MIN_SIZE, Math.max(MIN_SIZE, room.d));
  return { w, h, x: clamp(Math.round(b.x), 0, Math.max(0, room.w - w)), y: clamp(Math.round(b.y), 0, Math.max(0, room.d - h)) };
}

export const moveBy = (b: Box, dx: number, dy: number, room: Room): Box => clampBox({ ...b, x: b.x + dx, y: b.y + dy }, room);
/** Resizing keeps the top-left corner fixed; growth stops at the venue edge. */
export const resizeBy = (b: Box, dw: number, dh: number, room: Room): Box =>
  clampBox(
    {
      ...b,
      w: clamp(b.w + dw, MIN_SIZE, Math.max(MIN_SIZE, room.w - b.x)),
      h: clamp(b.h + dh, MIN_SIZE, Math.max(MIN_SIZE, room.d - b.y)),
    },
    room,
  );

/** Why a box is not valid, in plain words, or null when it fits. Used by the numeric form. */
export function boxProblem(b: Box, room: Room): string | null {
  if (![b.x, b.y, b.w, b.h].every(Number.isFinite)) return "Enter numbers for the position and size.";
  if (b.w < MIN_SIZE || b.h < MIN_SIZE) return `Width and depth must be at least ${MIN_SIZE / 100} m.`;
  if (b.x < 0 || b.y < 0) return "The position cannot be negative.";
  if (b.x + b.w > room.w) return `It reaches ${((b.x + b.w) / 100).toFixed(2)} m across; the venue is ${(room.w / 100).toFixed(2)} m wide.`;
  if (b.y + b.h > room.d) return `It reaches ${((b.y + b.h) / 100).toFixed(2)} m down; the venue is ${(room.d / 100).toFixed(2)} m deep.`;
  return null;
}

/** Metres typed by a person ("1.25", "3") to whole centimetres; null if not a non-negative number with at most 2 decimals. */
export function metresToCm(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export const cmToMetres = (cm: number): string => (cm % 100 === 0 ? String(cm / 100) : (cm / 100).toFixed(2));

/** Default new object: its usual size, placed in the middle of the room and kept inside it. */
export function newBox(kind: Kind, room: Room): Box {
  const [, , w, h] = KINDS.find(([k]) => k === kind) ?? KINDS[4];
  return clampBox({ x: (room.w - w) / 2, y: (room.d - h) / 2, w, h }, room);
}
