import "client-only";

import type { AuthSession, AuthSessionEvent } from "@/lib/services";
import { getBrowserServices } from "@/lib/services/runtime/browser";

export function subscribeToChatSessionChanges(
  callback: (event: AuthSessionEvent, session: AuthSession | null) => void
): () => void {
  return getBrowserServices().auth.subscribe(callback);
}
