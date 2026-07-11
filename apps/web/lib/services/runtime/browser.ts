import "client-only";

import type { AppServices, ChatRealtimeService } from "../contracts";
import { createBrowserSupabaseServices } from "../supabase/browser";
import { supabaseChatRealtimeService } from "../supabase/chat-realtime";

let services: AppServices | null = null;

export function getBrowserServices(): AppServices {
  services ??= createBrowserSupabaseServices();
  return services;
}

export function getChatRealtimeService(override?: ChatRealtimeService): ChatRealtimeService {
  return override ?? supabaseChatRealtimeService;
}
