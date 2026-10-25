"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { KINDS } from "@/lib/layout";
import { parseVenueForm } from "@/lib/venueForm";
import { createClient } from "@/lib/supabase/server";

export type LayoutFormState = { error?: string };
export type VenueFormState = { errors?: Record<string, string>; values?: Record<string, string>; error?: string };

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guard(fd: FormData) {
  const ws = field(fd, "ws");
  const ev = field(fd, "ev");
  if (!isUuid(ws) || !isUuid(ev)) redirect("/app");
  await requireUser(`/w/${ws}/events/${ev}/layout`);
  return { ws, ev, supabase: await createClient() };
}

function done(ws: string, ev: string, key: string): never {
  revalidatePath(`/w/${ws}/events/${ev}`, "layout");
  redirect(`/w/${ws}/events/${ev}/layout?m=${key}`);
}

type Upsert = { id?: string; version?: string; kind: string; label: string; x: number; y: number; w: number; h: number };

/** Validates the planner's JSON payload before it reaches the database (which enforces the same rules again). */
function parsePayload(raw: string): { upserts: Upsert[]; deletes: string[] } | null {
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p.upserts) || !Array.isArray(p.deletes) || p.upserts.length > 300 || p.deletes.length > 300) return null;
    const kinds: string[] = KINDS.map(([k]) => k);
    for (const u of p.upserts) {
      if (typeof u.kind !== "string" || !kinds.includes(u.kind)) return null;
      if (typeof u.label !== "string" || u.label.length > 60) return null;
      if (![u.x, u.y, u.w, u.h].every((n: unknown) => Number.isInteger(n))) return null;
      if (u.id !== undefined && (!isUuid(String(u.id)) || typeof u.version !== "string")) return null;
    }
    if (!p.deletes.every((d: unknown) => typeof d === "string" && isUuid(d))) return null;
    return { upserts: p.upserts, deletes: p.deletes };
  } catch {
    return null;
  }
}

/** Saves the whole layout edit in one transaction (all changes or none). */
export async function saveLayout(_: LayoutFormState, fd: FormData): Promise<LayoutFormState> {
  const { ws, ev, supabase } = await guard(fd);
  const payload = parsePayload(field(fd, "payload"));
  if (!payload) return { error: "The layout could not be read. Reload the page and try again. Nothing was saved." };
  const { error } = await supabase.rpc("save_layout", { ev, upserts: payload.upserts, deletes: payload.deletes });
  if (error) {
    const msg =
      error.code === "P0001" ? "The layout was changed by someone else. Reload the page to see their version; your unsaved changes were not saved."
      : error.code === "23514" ? "An object does not fit inside the venue, or the event has no venue. Nothing was saved."
      : error.code === "42501" ? "Only organisers and owners can edit the layout. Nothing was saved."
      : "We could not save the layout. Nothing was saved; try again.";
    return { error: msg };
  }
  done(ws, ev, "layout-saved");
}

export async function setEventVenue(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const venue = field(fd, "venue");
  if (venue && !isUuid(venue)) done(ws, ev, "invalid");
  const { data, error } = await supabase.from("events").update({ venue_id: venue || null }).eq("id", ev).eq("workspace_id", ws).select("id");
  done(ws, ev, error ? (error.code === "23514" ? "venue-fit" : "failed") : data?.length ? "venue-set" : "forbidden");
}

/** Create (no `item`) or edit (with `item` + `version`) a venue. */
export async function saveVenue(_: VenueFormState, fd: FormData): Promise<VenueFormState> {
  const { ws, ev, supabase } = await guard(fd);
  const parsed = parseVenueForm(fd);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.values };
  const item = field(fd, "item");
  if (item && !isUuid(item)) redirect("/app");
  if (!item) {
    const { error } = await supabase.from("venues").insert({ workspace_id: ws, ...parsed.data });
    if (error) return { error: "We could not add the venue. Organisers and owners manage venues; nothing was changed.", values: parsed.values };
    done(ws, ev, "venue-added");
  }
  const { data, error } = await supabase
    .from("venues")
    .update(parsed.data)
    .eq("id", item)
    .eq("workspace_id", ws)
    .eq("updated_at", field(fd, "version")) // stale-edit check
    .select("id");
  if (error) {
    return {
      error: error.code === "23514" ? "Some layout items would fall outside that size. Move or delete them first. Nothing was changed." : "We could not save the venue. Nothing was changed; try again.",
      values: parsed.values,
    };
  }
  if (!data?.length) return { error: "This venue was changed by someone else (or you no longer have permission). Reload the page to see the latest version.", values: parsed.values };
  done(ws, ev, "venue-saved");
}

/** Deleting a venue keeps every event that used it (they just lose the venue) and keeps their saved layout objects. */
export async function deleteVenue(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  if (!isUuid(id)) done(ws, ev, "invalid");
  const { data, error } = await supabase.from("venues").delete().eq("id", id).eq("workspace_id", ws).select("id");
  done(ws, ev, error ? "failed" : data?.length ? "venue-deleted" : "forbidden");
}
