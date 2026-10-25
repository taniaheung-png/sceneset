"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { parseEntryForm } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

export type EntryFormState = { errors?: Record<string, string>; values?: Record<string, string>; error?: string };

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guard(fd: FormData) {
  const ws = field(fd, "ws");
  const ev = field(fd, "ev");
  if (!isUuid(ws) || !isUuid(ev)) redirect("/app");
  await requireUser(`/w/${ws}/events/${ev}/schedule`);
  return { ws, ev, supabase: await createClient() };
}

function done(ws: string, ev: string, key: string): never {
  revalidatePath(`/w/${ws}/events/${ev}`, "layout");
  redirect(`/w/${ws}/events/${ev}/schedule?m=${key}`);
}

/** Add (no `item`) or edit (with `item` + `version`) a running-order entry. Times are in the event's timezone. */
export async function saveEntry(_: EntryFormState, fd: FormData): Promise<EntryFormState> {
  const { ws, ev, supabase } = await guard(fd);
  // The timezone comes from the saved event, never from the form, so it cannot be forged.
  const { data: event } = await supabase.from("events").select("timezone").eq("id", ev).eq("workspace_id", ws).maybeSingle();
  if (!event) redirect("/app");
  const parsed = parseEntryForm(fd, event.timezone);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.values };
  const item = field(fd, "item");
  if (item && !isUuid(item)) redirect("/app");

  if (!item) {
    const { error } = await supabase.from("schedule_entries").insert({ workspace_id: ws, event_id: ev, ...parsed.data });
    if (error) {
      const msg = error.code === "23503" ? "That person is not a member of this workspace. Choose someone from the list." : "We could not add the entry. Organisers and owners edit the running order; nothing was changed.";
      return { error: msg, values: parsed.values };
    }
    done(ws, ev, "entry-added");
  }
  const { data, error } = await supabase
    .from("schedule_entries")
    .update(parsed.data)
    .eq("id", item)
    .eq("event_id", ev)
    .eq("updated_at", field(fd, "version")) // stale-edit check
    .select("id");
  if (error) {
    const msg = error.code === "23503" ? "That person is not a member of this workspace. Choose someone from the list." : "We could not save your changes. Nothing was changed; try again.";
    return { error: msg, values: parsed.values };
  }
  if (!data?.length) {
    return { error: "This entry was changed by someone else (or you no longer have permission). Reload the page to see the latest version, then re-apply your edits.", values: parsed.values };
  }
  done(ws, ev, "entry-saved");
}

export async function deleteEntry(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  if (!isUuid(id)) done(ws, ev, "invalid");
  const { data, error } = await supabase.from("schedule_entries").delete().eq("id", id).eq("event_id", ev).select("id");
  done(ws, ev, error ? "failed" : data?.length ? "entry-deleted" : "forbidden");
}
