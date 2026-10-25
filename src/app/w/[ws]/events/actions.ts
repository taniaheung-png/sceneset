"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { parseEventForm } from "@/lib/eventForm";
import { createClient } from "@/lib/supabase/server";

export type EventFormState = { errors?: Record<string, string>; values?: Record<string, string>; error?: string };

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Create (no `ev`) or edit (with `ev` + `version`) an event. Returns field errors and the typed values on failure. */
export async function saveEvent(_: EventFormState, fd: FormData): Promise<EventFormState> {
  const ws = field(fd, "ws");
  const ev = field(fd, "ev");
  if (!isUuid(ws) || (ev && !isUuid(ev))) redirect("/app");
  await requireUser(`/w/${ws}/events`);

  const parsed = parseEventForm(fd);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.values };
  const supabase = await createClient();
  const data = { ...parsed.data };

  let newVenueId: string | null = null;
  if (parsed.newVenue) {
    const v = await supabase.from("venues").insert({ workspace_id: ws, ...parsed.newVenue }).select("id").single();
    if (v.error) return { error: "You do not have permission to add venues here.", values: parsed.values };
    newVenueId = v.data.id;
    data.venue_id = newVenueId;
  }

  if (!ev) {
    const { data: row, error } = await supabase.from("events").insert({ workspace_id: ws, ...data }).select("id").single();
    if (error || !row) {
      if (newVenueId) await supabase.from("venues").delete().eq("id", newVenueId); // best effort: no orphan venue
      if (error?.code === "53400") return { error: "The free plan allows 1 active event. Archive another event first, or ask the workspace owner to try a test upgrade under Plan.", values: parsed.values };
      return { error: "We could not create the event. Organisers and owners can create events; check your connection and try again.", values: parsed.values };
    }
    revalidatePath(`/w/${ws}/events`);
    redirect(`/w/${ws}/events/${row.id}?m=created`);
  }

  // Stale-update check: only update if nobody changed the row since this form was loaded.
  const { data: rows, error } = await supabase
    .from("events")
    .update(data)
    .eq("id", ev)
    .eq("workspace_id", ws)
    .eq("updated_at", field(fd, "version"))
    .select("id");
  if (error) return { error: "We could not save your changes. Nothing was changed; try again.", values: parsed.values };
  if (!rows?.length) {
    return {
      error: "This event was changed by someone else (or you no longer have permission). Reload the page to see the latest version, then re-apply your edits.",
      values: parsed.values,
    };
  }
  revalidatePath(`/w/${ws}/events`, "layout");
  redirect(`/w/${ws}/events/${ev}?m=saved`);
}

async function guard(fd: FormData) {
  const ws = field(fd, "ws");
  const ev = field(fd, "ev");
  if (!isUuid(ws) || !isUuid(ev)) redirect("/app");
  await requireUser(`/w/${ws}/events`);
  return { ws, ev, supabase: await createClient() };
}

/**
 * Loads (or resets) the fictional sample event in THIS workspace. Needs sign-in and an owner/organiser role;
 * the database function removes only previously loaded sample rows here and never touches other data.
 */
export async function loadSampleEvent(fd: FormData) {
  const { ws, supabase } = await guardWs(fd);
  const { data, error } = await supabase.rpc("reset_demo", { ws });
  revalidatePath(`/w/${ws}/events`, "layout");
  if (error || !data) redirect(`/w/${ws}/events?m=${error?.code === "42501" ? "forbidden" : "sample-failed"}`);
  redirect(`/w/${ws}/events/${data}?m=sample`);
}

async function guardWs(fd: FormData) {
  const ws = field(fd, "ws");
  if (!isUuid(ws)) redirect("/app");
  await requireUser(`/w/${ws}/events`);
  return { ws, supabase: await createClient() };
}

export async function setArchived(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const archive = field(fd, "archive") === "1";
  const { data, error } = await supabase
    .from("events")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", ev)
    .eq("workspace_id", ws)
    .select("id");
  revalidatePath(`/w/${ws}/events`, "layout");
  if (error?.code === "53400") redirect(`/w/${ws}/events?m=plan-limit`);
  redirect(`/w/${ws}/events?m=${data?.length ? (archive ? "archived" : "unarchived") : "forbidden"}`);
}

export async function deleteEvent(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const { data } = await supabase.from("events").delete().eq("id", ev).eq("workspace_id", ws).select("id");
  revalidatePath(`/w/${ws}/events`, "layout");
  redirect(`/w/${ws}/events?m=${data?.length ? "deleted" : "forbidden"}`);
}
