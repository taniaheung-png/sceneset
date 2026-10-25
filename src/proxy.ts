import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/config";

// Refreshes the Supabase session cookies and gates private routes. This is the ONLY place that refreshes
// tokens (refreshing in two places can revoke the session). Pages still re-check the user themselves.
const PRIVATE = /^\/(app|onboarding|w)(\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPrivate = PRIVATE.test(pathname);

  if (!supabaseConfigured) {
    // Never fail open: private routes send you to a login page that explains the missing setup.
    if (!isPrivate) return NextResponse.next();
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "config");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (isPrivate && !signedIn) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/app", "/onboarding", "/w/:path*", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/:path*"],
};
