import "server-only";

import { refreshSupabaseSession } from "@/lib/services/supabase/proxy";
import { type NextRequest } from "next/server";

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
  // IMPORTANT: no logic before the refresh call — the service owns the
  // getClaims() sequence and refreshed-cookie copy contract.
  return refreshSupabaseSession(request);
}
