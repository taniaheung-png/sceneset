// Public Supabase settings. Canonical name is PUBLISHABLE_KEY; the legacy ANON_KEY name still works.
// Both are safe to ship to the browser: data is protected by RLS, not by hiding this key.
// Literal `process.env.X` access is required so Next.js can inline NEXT_PUBLIC_ values.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
