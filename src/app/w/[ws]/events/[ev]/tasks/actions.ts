"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["todo", "in_progress", "done"];
const PRIORITIES = ["low", "medium", "high"];
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Result keys go in the URL (?m=…) and are mapped to fixed text by the page; no URL text is ever displayed.
const keyFor = (code?: string) => (code === "42501" ? "forbidden" : code === "23503" ? "bad-link" : "failed");

async function guard(fd: FormData) {
  const ws = field(fd, "ws");
  const ev = field(fd, "ev");
  if (!isUuid(ws) || !isUuid(ev)) redirect("/app");
  const user = await requireUser(`/w/${ws}/events/${ev}/tasks`);
  return { ws, ev, user, supabase: await createClient() };
}

async function done(ws: string, ev: string, key: string): Promise<never> {
  revalidatePath(`/w/${ws}/events/${ev}`, "layout");
  redirect(`/w/${ws}/events/${ev}/tasks?m=${key}`);
}

/** Shared parsing for create and edit. Returns null when any value is invalid. */
function taskFields(fd: FormData) {
  const title = field(fd, "title");
  const priority = field(fd, "priority");
  const due = field(fd, "due");
  const assignee = field(fd, "assignee");
  const description = field(fd, "description");
  if (title.length < 1 || title.length > 200 || description.length > 2000) return null;
  if (!PRIORITIES.includes(priority)) return null;
  if (due && (!DATE.test(due) || Number.isNaN(Date.parse(due)))) return null;
  if (assignee && !isUuid(assignee)) return null;
  return { title, description, priority, due_on: due || null, assignee_id: assignee || null };
}

export async function createTask(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const f = taskFields(fd);
  if (!f) return done(ws, ev, "invalid");
  const { error } = await supabase.from("tasks").insert({ workspace_id: ws, event_id: ev, ...f });
  return done(ws, ev, error ? keyFor(error.code) : "task-added");
}

export async function updateTask(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "id");
  const f = taskFields(fd);
  if (!isUuid(id) || !f) return done(ws, ev, "invalid");
  const { data, error } = await supabase.from("tasks").update(f).eq("id", id).eq("event_id", ev).select("id");
  return done(ws, ev, error ? keyFor(error.code) : data?.length ? "task-saved" : "forbidden");
}

/** Allowed for owners/organisers on any task, and for a collaborator on tasks assigned to them (RLS + trigger). */
export async function setTaskStatus(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "id");
  const status = field(fd, "status");
  if (!isUuid(id) || !STATUSES.includes(status)) return done(ws, ev, "invalid");
  const { data, error } = await supabase.from("tasks").update({ status }).eq("id", id).eq("event_id", ev).select("id");
  return done(ws, ev, error ? keyFor(error.code) : data?.length ? "task-moved" : "forbidden");
}

export async function deleteTask(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "id");
  if (!isUuid(id)) return done(ws, ev, "invalid");
  const { data, error } = await supabase.from("tasks").delete().eq("id", id).eq("event_id", ev).select("id");
  return done(ws, ev, error ? keyFor(error.code) : data?.length ? "task-deleted" : "forbidden");
}

export async function addNote(fd: FormData) {
  const { ws, ev, user, supabase } = await guard(fd);
  const body = field(fd, "body");
  if (body.length < 1 || body.length > 5000) return done(ws, ev, "invalid");
  const { error } = await supabase.from("notes").insert({ workspace_id: ws, event_id: ev, body, author_id: user.id });
  return done(ws, ev, error ? keyFor(error.code) : "note-added");
}

export async function updateNote(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "id");
  const body = field(fd, "body");
  if (!isUuid(id) || body.length < 1 || body.length > 5000) return done(ws, ev, "invalid");
  const { data, error } = await supabase.from("notes").update({ body }).eq("id", id).eq("event_id", ev).select("id");
  return done(ws, ev, error ? keyFor(error.code) : data?.length ? "note-saved" : "forbidden");
}

export async function deleteNote(fd: FormData) {
  const { ws, ev, supabase } = await guard(fd);
  const id = field(fd, "id");
  if (!isUuid(id)) return done(ws, ev, "invalid");
  const { data, error } = await supabase.from("notes").delete().eq("id", id).eq("event_id", ev).select("id");
  return done(ws, ev, error ? keyFor(error.code) : data?.length ? "note-deleted" : "forbidden");
}
