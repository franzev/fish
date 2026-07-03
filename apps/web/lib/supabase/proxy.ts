import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every navigation.
 *
 * Contract (Pitfall 5 — do not "improve" this):
 * - This function returns exactly ONE response, and refreshed cookies are
 *   written to BOTH the request and that response. Constructing a response
 *   anywhere else without copying these cookies would silently drop the
 *   refreshed session and randomly log users out after token expiry.
 * - `NextResponse.next({ request })` snapshots the request headers at
 *   construction time, so setAll must re-create the response AFTER writing
 *   the refreshed cookies onto the request (the documented @supabase/ssr
 *   pattern). Otherwise server components render this same navigation with
 *   the STALE cookie, and the browser and server drift onto different
 *   sessions.
 * - getClaims() runs immediately after client creation with no logic between.
 * - Route protection does NOT live here — Phase 3 owns redirects; this phase
 *   is session refresh only (AUTH-05).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          // Re-snapshot WITH the updated request so downstream server
          // components see the refreshed session on this same navigation.
          response = NextResponse.next({ request });
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
