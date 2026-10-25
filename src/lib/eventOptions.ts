export const EVENT_TYPES = ["Pop-up market", "Party", "Showcase", "Community event", "Festival", "Other"] as const;
export const EVENT_STATUSES = [
  ["planning", "Planning"],
  ["confirmed", "Confirmed"],
  ["done", "Done"],
] as const;
export const CURRENCIES = ["HKD", "USD", "EUR", "GBP", "SGD"] as const;
// A short, readable list; the database accepts any valid IANA zone, so extend this list if needed.
export const TIMEZONES = [
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;
