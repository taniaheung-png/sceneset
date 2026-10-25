import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfigured, supabaseKey, supabaseUrl } from "./config";

/** Per-request server client acting as the signed-in user, so RLS applies to every query. */
export async function createClient() {
  if (!supabaseConfigured) throw new Error("Supabase is not configured. Set the variables in .env.local (see .env.example).");
  const store = await cookies();
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by proxy.ts instead.
        }
      },
    },
  });
}
