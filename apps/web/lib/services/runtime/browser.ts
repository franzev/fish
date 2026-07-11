import "client-only";

import type { AppServices } from "../contracts";
import { createBrowserSupabaseServices } from "../supabase/browser";
export * from "../supabase/chat-realtime";

let services: AppServices | null = null;

export function getBrowserServices(overrides?: AppServices): AppServices {
  if (overrides) return overrides;
  services ??= createBrowserSupabaseServices();
  return services;
}
