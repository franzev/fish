import "client-only";

import type {
  AppServices,
  AvatarCommandService,
  CallCommandService,
  CallRealtimeService,
  ChatImageService,
  ChatRealtimeService,
  FriendCommandService,
  FriendRealtimeService,
  NotificationCommandService,
  NotificationRealtimeService,
  AttentionRealtimeService,
} from "../contracts";
import { SupabaseCallCommandService } from "../supabase/call-command-service";
import { supabaseCallRealtimeService } from "../supabase/call-realtime";
import {
  createBrowserSupabaseClient,
  createBrowserSupabaseServices,
} from "../supabase/browser";
import { supabaseChatRealtimeService } from "../supabase/chat-realtime";
import { chatImageService } from "../supabase/chat-images";
import { SupabaseFriendCommandService } from "../supabase/friend-command-service";
import { supabaseFriendRealtimeService } from "../supabase/friend-realtime";
import { SupabaseNotificationCommandService } from "../supabase/notification-command-service";
import { supabaseNotificationRealtimeService } from "../supabase/notification-realtime";
import { supabaseAttentionRealtimeService } from "../supabase/attention-realtime";

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

export function getAvatarCommandService(
  override?: AvatarCommandService
): AvatarCommandService {
  return override ?? getBrowserServices().avatars;
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

export function getFriendCommandService(
  override?: FriendCommandService
): FriendCommandService {
  return override ?? new SupabaseFriendCommandService(createBrowserSupabaseClient());
}

export function getFriendRealtimeService(
  override?: FriendRealtimeService
): FriendRealtimeService {
  return override ?? supabaseFriendRealtimeService;
}

export function getNotificationCommandService(
  override?: NotificationCommandService
): NotificationCommandService {
  return override ?? new SupabaseNotificationCommandService(createBrowserSupabaseClient());
}

export function getNotificationRealtimeService(
  override?: NotificationRealtimeService
): NotificationRealtimeService {
  return override ?? supabaseNotificationRealtimeService;
}

export function getAttentionRealtimeService(
  override?: AttentionRealtimeService
): AttentionRealtimeService {
  return override ?? supabaseAttentionRealtimeService;
}
