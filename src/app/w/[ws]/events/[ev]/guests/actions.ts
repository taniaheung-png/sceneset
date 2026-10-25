"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { parseGuestForm } from "@/lib/guestForm";
import { RSVPS } from "@/lib/guests";
import { createClient } from "@/lib/supabase/server";

export type GuestFormState = { errors?: Record<string, string>; values?: Record<string, string>; error?: string };

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guard(fd: FormData) {
  const ws = field(fd, "ws");
  const ev = field(fd, "ev");
  if (!isUuid(ws) || !isUuid(ev)) redirect("/app");
  await requireUser(`/w/${ws}/events/${ev}/guests`);
  return { ws, ev, supabase: await createClient() };
}

function done(ws: string, ev: string, key: string): never {
  revalidatePath(`/w/${ws}/events/${ev}`, "layout");
  redirect(`/w/${ws}/events/${ev}/guests?m=${key}`);
}

/** Add (no `item`) or edit (with `item` + `version`) a guest. Returns field errors and typed values on failure. */
export async function saveGuest(_: GuestFormState, fd: FormData): Promise<GuestFormState> {
  const { ws, ev, supabase } = await guard(fd);
  const parsed = parseGuestForm(fd);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.values };
  const item = field(fd, "item");
  if (item && !isUuid(item)) redirect("/app");

  if (!item) {
    const { error } = await supabase.from("guests").insert({ workspace_id: ws, event_id: ev, ...parsed.data });
    if (error) return { error: "We could not add the guest. Organisers and owners manage guests; nothing was changed.", values: parsed.values };
    done(ws, ev, "guest-added");
  }
  const { data, error } = await supabase
    .from("guests")
    .update(parsed.data)
    .eq("id", item)
    .eq("event_id", ev)
    .eq("updated_at", field(fd, "version")) // stale-edit check
    .select("id");
  if (error) return { error: "We could not save your changes. Nothing was changed; try again.", values: parsed.values };
  if (!data?.length) {
    return { error: "This guest was changed by someone else (or you no longer have permission). Reload the page to see the latest version, then re-apply your edits.", values: parsed.values };
  }
  done(ws, ev, "guest-saved");
}

/** One-click RSVP change from the table. */
export async function setRsvp(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  const rsvp = field(fd, "rsvp");
  if (!isUuid(id) || !RSVPS.some(([k]) => k === rsvp)) done(ws, ev, "invalid");
  const { data, error } = await supabase.from("guests").update({ rsvp }).eq("id", id).eq("event_id", ev).select("id");
  done(ws, ev, error ? "failed" : data?.length ? "rsvp-saved" : "forbidden");
}

export async function deleteGuest(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  if (!isUuid(id)) done(ws, ev, "invalid");
  const { data, error } = await supabase.from("guests").delete().eq("id", id).eq("event_id", ev).select("id");
  done(ws, ev, error ? "failed" : data?.length ? "guest-deleted" : "forbidden");
}
