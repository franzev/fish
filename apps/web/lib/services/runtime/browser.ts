import "client-only";

import type { AppServices, ChatImageService, ChatRealtimeService } from "../contracts";
import { createBrowserSupabaseServices } from "../supabase/browser";
import { supabaseChatRealtimeService } from "../supabase/chat-realtime";
import { chatImageService } from "../supabase/chat-images";

let services: AppServices | null = null;

export function getBrowserServices(): AppServices {
  services ??= createBrowserSupabaseServices();
  return services;
}

export function getChatRealtimeService(override?: ChatRealtimeService): ChatRealtimeService {
  return override ?? supabaseChatRealtimeService;
}

export function getChatImageService(override?: ChatImageService): ChatImageService {
  return override ?? chatImageService;
}
