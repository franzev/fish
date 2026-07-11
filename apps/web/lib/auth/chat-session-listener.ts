import { createBrowserSupabaseClient } from "@/lib/services/supabase/browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export function subscribeToChatSessionChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const client = createBrowserSupabaseClient();
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(callback);

  return () => subscription.unsubscribe();
}
