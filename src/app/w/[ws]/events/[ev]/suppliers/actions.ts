"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { BUDGET_CATEGORIES } from "@/lib/eventOptions";
import { isQuoteStatus, parseQuoteForm } from "@/lib/budgetForm";
import { createClient } from "@/lib/supabase/server";

export type QuoteFormState = { errors?: Record<string, string>; values?: Record<string, string>; error?: string };

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Result keys go in the URL (?m=…) and are mapped to fixed text by the page.
function keyFor(code?: string): string {
  switch (code) {
    case "42501": return "forbidden";
    case "23001":
    case "23503": return "supplier-in-use";
    case "23505": return "linked-elsewhere";
    case "23514": return "paid-too-high";
    case "P0001": return "locked";
    case "P0002": return "line-unavailable";
    default: return "failed";
  }
}

async function guard(fd: FormData) {
  const ws = field(fd, "ws");
  const ev = field(fd, "ev");
  if (!isUuid(ws) || !isUuid(ev)) redirect("/app");
  await requireUser(`/w/${ws}/events/${ev}/suppliers`);
  return { ws, ev, supabase: await createClient() };
}

async function done(ws: string, ev: string, key: string): Promise<never> {
  revalidatePath(`/w/${ws}/events/${ev}`, "layout");
  redirect(`/w/${ws}/events/${ev}/suppliers?m=${key}`);
}

function supplierFields(fd: FormData) {
  const name = field(fd, "name");
  const category = field(fd, "category");
  const contact_note = field(fd, "contact_note");
  const notes = field(fd, "notes");
  if (name.length < 1 || name.length > 120 || contact_note.length > 300 || notes.length > 2000) return null;
  if (!(BUDGET_CATEGORIES as readonly string[]).includes(category)) return null;
  return { name, category, contact_note, notes };
}

export async function addSupplier(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const f = supplierFields(fd);
  if (!f) return done(ws, ev, "invalid");
  const { error } = await supabase.from("suppliers").insert({ workspace_id: ws, ...f });
  return done(ws, ev, error ? keyFor(error.code) : "supplier-added");
}

export async function updateSupplier(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  const f = supplierFields(fd);
  if (!isUuid(id) || !f) return done(ws, ev, "invalid");
  const { data, error } = await supabase.from("suppliers").update(f).eq("id", id).eq("workspace_id", ws).select("id");
  return done(ws, ev, error ? keyFor(error.code) : data?.length ? "supplier-saved" : "forbidden");
}

export async function deleteSupplier(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  if (!isUuid(id)) return done(ws, ev, "invalid");
  // A supplier that has quotes is kept (history): the database refuses and we explain why.
  const { data, error } = await supabase.from("suppliers").delete().eq("id", id).eq("workspace_id", ws).select("id");
  return done(ws, ev, error ? keyFor(error.code) : data?.length ? "supplier-deleted" : "forbidden");
}

/** Add (no `item`) or edit (with `item` + `version`) a quote. Returns field errors and typed values on failure. */
export async function saveQuote(_: QuoteFormState, fd: FormData): Promise<QuoteFormState> {
  const { ws, ev, supabase } = await guard(fd);
  const parsed = parseQuoteForm(fd);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.values };
  const item = field(fd, "item");
  if (item && !isUuid(item)) redirect("/app");

  if (!item) {
    const { error } = await supabase.from("quotes").insert({ workspace_id: ws, event_id: ev, ...parsed.data });
    if (error) {
      const forged = error.code === "23503";
      return { error: forged ? "That supplier is not in this workspace. Choose one from the list." : "We could not save the quote. Nothing was changed; try again.", values: parsed.values };
    }
    return done(ws, ev, "quote-added");
  }

  const { data, error } = await supabase
    .from("quotes")
    .update(parsed.data)
    .eq("id", item)
    .eq("event_id", ev)
    .eq("updated_at", field(fd, "version"))
    .select("id");
  if (error) {
    return { error: error.code === "P0001" ? "This quote is accepted. Re-open it before changing the amount or supplier." : "We could not save your changes. Nothing was changed; try again.", values: parsed.values };
  }
  if (!data?.length) {
    return { error: "This quote was changed by someone else (or you no longer have permission). Reload the page to see the latest version, then re-apply your edits.", values: parsed.values };
  }
  return done(ws, ev, "quote-saved");
}

/** requested / shortlisted / rejected. Accepting is a separate action that also creates the budget link. */
export async function setQuoteStatus(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  const status = field(fd, "status");
  if (!isUuid(id) || !isQuoteStatus(status) || status === "accepted") return done(ws, ev, "invalid");
  const { data, error } = await supabase.from("quotes").update({ status }).eq("id", id).eq("event_id", ev).select("id");
  return done(ws, ev, error ? keyFor(error.code) : data?.length ? "quote-moved" : "forbidden");
}

export async function acceptQuote(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  const into = field(fd, "into");
  if (!isUuid(id) || (into && !isUuid(into))) return done(ws, ev, "invalid");
  const { error } = await supabase.rpc("accept_quote", { quote: id, into_item: into || null });
  return done(ws, ev, error ? keyFor(error.code) : "quote-accepted");
}

export async function reopenQuote(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  if (!isUuid(id)) return done(ws, ev, "invalid");
  const { error } = await supabase.rpc("reopen_quote", { quote: id });
  return done(ws, ev, error ? keyFor(error.code) : "quote-reopened");
}

export async function deleteQuote(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "item");
  if (!isUuid(id)) return done(ws, ev, "invalid");
  const { data, error } = await supabase.from("quotes").delete().eq("id", id).eq("event_id", ev).select("id");
  return done(ws, ev, error ? keyFor(error.code) : data?.length ? "quote-deleted" : "forbidden");
}
