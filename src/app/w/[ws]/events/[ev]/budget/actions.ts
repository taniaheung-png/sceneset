"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { parseBudgetItemForm } from "@/lib/budgetForm";
import { createClient } from "@/lib/supabase/server";

export type BudgetFormState = { errors?: Record<string, string>; values?: Record<string, string>; error?: string };

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guard(fd: FormData) {
  const ws = field(fd, "ws");
  const ev = field(fd, "ev");
  if (!isUuid(ws) || !isUuid(ev)) redirect("/app");
  await requireUser(`/w/${ws}/events/${ev}/budget`);
  return { ws, ev, supabase: await createClient() };
}

function finish(ws: string, ev: string, key: string, filter = ""): never {
  revalidatePath(`/w/${ws}/events/${ev}`, "layout");
  redirect(`/w/${ws}/events/${ev}/budget?m=${key}${filter ? `&category=${encodeURIComponent(filter)}` : ""}`);
}

/** Add (no `item`) or edit (with `item` + `version`) a budget line. Returns field errors and typed values on failure. */
export async function saveBudgetItem(_: BudgetFormState, fd: FormData): Promise<BudgetFormState> {
  const { ws, ev, supabase } = await guard(fd);
  const item = field(fd, "item");
  if (item && !isUuid(item)) redirect("/app");

  if (!item) {
    const parsed = parseBudgetItemForm(fd);
    if (!parsed.data) return { errors: parsed.errors, values: parsed.values };
    const { error } = await supabase.from("budget_items").insert({ workspace_id: ws, event_id: ev, ...parsed.data });
    if (error) return { error: "We could not add the line. Organisers and owners can edit the budget; nothing was changed.", values: parsed.values };
    finish(ws, ev, "item-added");
  }

  // Lines linked to an accepted quote have their committed amount fixed by the quote.
  const { data: current } = await supabase.from("budget_items").select("quote_id").eq("id", item).eq("event_id", ev).maybeSingle();
  if (!current) return { error: "That budget line no longer exists. Reload the page.", values: Object.fromEntries(fd.entries()) as Record<string, string> };
  const linked = current.quote_id !== null;
  const parsed = parseBudgetItemForm(fd, linked);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.values };
  const { committed_minor, ...rest } = parsed.data;
  const patch = linked ? rest : { ...rest, committed_minor };

  const { data, error } = await supabase
    .from("budget_items")
    .update(patch)
    .eq("id", item)
    .eq("event_id", ev)
    .eq("updated_at", field(fd, "version")) // stale-edit check
    .select("id");
  if (error) {
    const msg = error.code === "23514" ? "Paid cannot be more than the committed amount." : "We could not save your changes. Nothing was changed; try again.";
    return { error: msg, values: parsed.values };
  }
  if (!data?.length) {
    return { error: "This line was changed by someone else (or you no longer have permission). Reload the page to see the latest version, then re-apply your edits.", values: parsed.values };
  }
  finish(ws, ev, "item-saved");
}

export async function deleteBudgetItem(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  if (!isUuid(id)) finish(ws, ev, "invalid");
  const { data, error } = await supabase.from("budget_items").delete().eq("id", id).eq("event_id", ev).select("id");
  finish(ws, ev, error ? "failed" : data?.length ? "item-deleted" : "forbidden");
}
