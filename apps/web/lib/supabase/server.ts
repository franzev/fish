import "server-only";

import { createServerSupabaseClient } from "@/lib/services/supabase/server";

/**
 * Compatibility adapter for Server Components, Server Actions, and Route
 * Handlers.
 *
 * Read auth via getUser()/getClaims() only — never getSession() server-side:
 * getSession() trusts the cookie without verification, so a forged cookie passes.
 */
export async function createClient() {
  return createServerSupabaseClient();
}
