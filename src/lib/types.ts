// Row shapes for the tables used so far. Written by hand because generated types need the live project.
// Keep in sync with supabase/migrations.
export type EventRow = {
  id: string;
  workspace_id: string;
  title: string;
  type: string;
  goals: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  currency: string;
  venue_id: string | null;
  capacity: number | null;
  budget_target_minor: number;
  status: "planning" | "confirmed" | "done";
  archived_at: string | null;
  updated_at: string;
  /** True for the fictional sample event loaded by "Load a sample event". */
  demo: boolean;
  venues: { id: string; name: string } | null;
};

export type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_on: string | null;
  assignee_id: string | null;
  updated_at: string;
};

export type SupplierRow = { id: string; name: string; category: string; contact_note: string; notes: string; updated_at: string };

export type QuoteRow = {
  id: string;
  supplier_id: string;
  amount_minor: number;
  scope: string;
  status: "requested" | "shortlisted" | "accepted" | "rejected";
  notes: string;
  updated_at: string;
  suppliers: { id: string; name: string; category: string } | null;
};

export type BudgetRow = {
  id: string;
  category: string;
  name: string;
  planned_minor: number;
  committed_minor: number;
  paid_minor: number;
  quote_id: string | null;
  updated_at: string;
};

export type GuestRow = {
  id: string;
  name: string;
  contact: string | null;
  group_name: string;
  party_size: number;
  rsvp: "invited" | "confirmed" | "tentative" | "declined";
  notes: string;
  updated_at: string;
};

export type ScheduleRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  owner_id: string | null;
  notes: string;
  updated_at: string;
};

export type VenueRow = { id: string; name: string; address_note: string; width_cm: number; depth_cm: number; updated_at: string };

export type LayoutItemRow = {
  id: string;
  kind: "table" | "stage" | "entrance" | "booth" | "other";
  label: string;
  x_cm: number;
  y_cm: number;
  w_cm: number;
  h_cm: number;
  updated_at: string;
};

export type NoteRow = { id: string; body: string; author_id: string | null; created_at: string; updated_at: string };

export type MemberRow = { user_id: string; display_name: string; role: string; email: string | null };
