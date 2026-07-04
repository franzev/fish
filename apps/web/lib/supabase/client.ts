import { createBrowserSupabaseClient } from "@/lib/services/supabase/browser";

/**
 * Compatibility adapter for existing Client Components.
 *
 * New code should prefer `createBrowserSupabaseServices()` when it wants the
 * service/repository interfaces; this helper intentionally keeps returning the
 * raw typed client because current forms call Supabase auth methods directly.
 */
export function createClient() {
  return createBrowserSupabaseClient();
}
