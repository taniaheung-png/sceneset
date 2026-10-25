import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

/**
 * Server-only client with the secret key, used ONLY for permanently deleting an auth account (the one thing a signed-in
 * user's own key cannot do). Never import this from a client component or put the key in a NEXT_PUBLIC_ variable.
 * Returns null when no secret key is configured, so callers can refuse before changing anything.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
