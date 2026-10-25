// Guest arithmetic. A guest RECORD may stand for several people (party_size), so records and people (headcount)
// are always counted separately. Attending headcount = people on CONFIRMED records only.

export type Rsvp = "invited" | "confirmed" | "tentative" | "declined";
export const RSVPS: readonly (readonly [Rsvp, string])[] = [
  ["invited", "Invited (no reply yet)"],
  ["confirmed", "Confirmed"],
  ["tentative", "Tentative"],
  ["declined", "Declined"],
];
export const rsvpLabel = (r: Rsvp) => RSVPS.find(([k]) => k === r)?.[1] ?? r;

export type GuestLike = { rsvp: Rsvp; party_size: number };

export type GuestSummary = {
  /** Number of guest records per RSVP status. */
  records: Record<Rsvp, number>;
  /** Number of people (sum of party sizes) per RSVP status. */
  people: Record<Rsvp, number>;
  totalRecords: number;
  /** People on confirmed records: the headcount compared with capacity. */
  attending: number;
  /** Confirmed plus tentative people: the most who could come. */
  possible: number;
  capacity: number | null;
  /** capacity - attending (negative when over). Null when no capacity is set. */
  remaining: number | null;
  over: boolean;
  /** Within capacity now, but confirmed + tentative would exceed it. */
  mayExceed: boolean;
};

export function guestSummary(guests: GuestLike[], capacity: number | null): GuestSummary {
  const records = { invited: 0, confirmed: 0, tentative: 0, declined: 0 };
  const people = { invited: 0, confirmed: 0, tentative: 0, declined: 0 };
  for (const g of guests) {
    records[g.rsvp] += 1;
    people[g.rsvp] += g.party_size;
  }
  const attending = people.confirmed;
  const possible = people.confirmed + people.tentative;
  const hasCapacity = capacity !== null;
  return {
    records,
    people,
    totalRecords: guests.length,
    attending,
    possible,
    capacity,
    remaining: hasCapacity ? capacity - attending : null,
    over: hasCapacity && attending > capacity,
    mayExceed: hasCapacity && attending <= capacity && possible > capacity,
  };
}
