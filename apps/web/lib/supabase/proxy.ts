import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every navigation.
 *
 * Contract (Pitfall 5 — do not "improve" this):
 * - Exactly ONE NextResponse is constructed; a second construction after the
 *   cookie handlers are wired would silently drop the refreshed session cookie
 *   and randomly log users out after token expiry.
 * - Cookies are written to BOTH the request and that single response.
 * - getClaims() runs immediately after client creation with no logic between.
 * - Route protection does NOT live here — Phase 3 owns redirects; this phase
 *   is session refresh only (AUTH-05).
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: no logic between client creation and this call — the refresh
  // must run before anything can short-circuit or replace the response.
  await supabase.auth.getClaims();

  return response;
}
