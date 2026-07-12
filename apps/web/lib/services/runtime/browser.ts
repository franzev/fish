import "client-only";

import type {
  AppServices,
  CallCommandService,
  CallRealtimeService,
  ChatImageService,
  ChatRealtimeService,
} from "../contracts";
import { SupabaseCallCommandService } from "../supabase/call-command-service";
import { supabaseCallRealtimeService } from "../supabase/call-realtime";
import {
  createBrowserSupabaseClient,
  createBrowserSupabaseServices,
} from "../supabase/browser";
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

export function getCallCommandService(
  override?: CallCommandService
): CallCommandService {
  return override ?? new SupabaseCallCommandService(createBrowserSupabaseClient());
}

export function getCallRealtimeService(
  override?: CallRealtimeService
): CallRealtimeService {
  return override ?? supabaseCallRealtimeService;
}
