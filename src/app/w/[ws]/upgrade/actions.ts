"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid, requireUser } from "@/lib/auth";
import { IDEMPOTENCY_KEY, isPlanId, resultFromError, sandboxEnabled, type CheckoutResult } from "@/lib/entitlements";
import { adminClient } from "@/lib/supabase/admin";

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const OUTCOMES = ["success", "cancelled", "failed"];

function done(ws: string, result: CheckoutResult): never {
  revalidatePath(`/w/${ws}`, "layout");
  redirect(`/w/${ws}/upgrade?r=${result}`); // the page shows a fixed message for this key; only the database decides what is granted
}

/**
 * The simulated checkout result. Authenticates, requires the sandbox switch, validates every field, then calls the database
 * function with the server's secret key, passing the verified user as `actor`. Signed-in users cannot execute that function
 * (migration 008), so the switch cannot be bypassed by calling the API directly; the function re-checks that the actor owns
 * the workspace and that the event belongs to it. Cancel and failure are logged and grant nothing. The success redirect
 * carries no authority: the plan is read back from the database.
 */
export async function completeCheckout(fd: FormData) {
  const ws = field(fd, "ws");
  if (!isUuid(ws)) redirect("/app");
  const user = await requireUser(`/w/${ws}/upgrade`);
  if (!sandboxEnabled()) return done(ws, "unavailable");

  const plan = field(fd, "plan");
  const ev = field(fd, "ev");
  const outcome = field(fd, "outcome");
  const key = field(fd, "key");
  if (!isPlanId(plan) || !OUTCOMES.includes(outcome) || !IDEMPOTENCY_KEY.test(key)) return done(ws, "invalid");
  if ((plan === "event") !== (ev !== "") || (ev !== "" && !isUuid(ev))) return done(ws, "invalid");

  const admin = adminClient();
  if (!admin) return done(ws, "unavailable");
  const { data, error } = await admin.rpc("sandbox_checkout", {
    actor: user.id,
    ws,
    plan_id: plan,
    ev: ev || null,
    outcome,
    idem: key,
  });
  if (error) return done(ws, resultFromError(error.code));
  const r = data as { outcome: CheckoutResult; replayed: boolean } | null;
  if (!r) return done(ws, "error");
  return done(ws, r.replayed ? "replayed" : r.outcome);
}

/** Ends the simulated Organiser plan (there is no recurring billing to stop). */
export async function endOrganiser(fd: FormData) {
  const ws = field(fd, "ws");
  if (!isUuid(ws)) redirect("/app");
  const user = await requireUser(`/w/${ws}/upgrade`);
  if (!sandboxEnabled()) return done(ws, "unavailable");
  const admin = adminClient();
  if (!admin) return done(ws, "unavailable");
  const { error } = await admin.rpc("sandbox_end_organiser", { actor: user.id, ws });
  return done(ws, error ? resultFromError(error.code) : "ended");
}
