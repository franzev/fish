import "client-only";

import { isSentryEnabled } from "@/lib/observability/environment";
import { observeServiceTree } from "@/lib/observability/service-observer";
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
  PresenceCommandService,
  PresenceRealtimeService,
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
import { SupabasePresenceCommandService } from "../supabase/presence-command-service";
import { supabasePresenceRealtimeService } from "../supabase/presence-realtime";

let services: AppServices | null = null;
let callCommands: CallCommandService | null = null;
let friendCommands: FriendCommandService | null = null;
let notificationCommands: NotificationCommandService | null = null;
let presenceCommands: PresenceCommandService | null = null;

function observeBrowserService<T extends object>(
  service: T,
  prefix: string
): T {
  return isSentryEnabled()
    ? observeServiceTree(service, { prefix, runtime: "browser" })
    : service;
}

export function getBrowserServices(): AppServices {
  services ??= observeBrowserService(
    createBrowserSupabaseServices(),
    "services.browser"
  );
  return services;
}

export function getChatRealtimeService(override?: ChatRealtimeService): ChatRealtimeService {
  return override ?? observeBrowserService(supabaseChatRealtimeService, "services.chatRealtime");
}

export function getChatImageService(override?: ChatImageService): ChatImageService {
  return override ?? observeBrowserService(chatImageService, "services.chatImages");
}

export function getAvatarCommandService(
  override?: AvatarCommandService
): AvatarCommandService {
  return override ?? getBrowserServices().avatars;
}

export function getCallCommandService(
  override?: CallCommandService
): CallCommandService {
  if (override) return override;
  callCommands ??= observeBrowserService(
    new SupabaseCallCommandService(createBrowserSupabaseClient()),
    "services.callCommands"
  );
  return callCommands;
}

export function getCallRealtimeService(
  override?: CallRealtimeService
): CallRealtimeService {
  return override ?? observeBrowserService(supabaseCallRealtimeService, "services.callRealtime");
}

export function getFriendCommandService(
  override?: FriendCommandService
): FriendCommandService {
  if (override) return override;
  friendCommands ??= observeBrowserService(
    new SupabaseFriendCommandService(createBrowserSupabaseClient()),
    "services.friendCommands"
  );
  return friendCommands;
}

export function getFriendRealtimeService(
  override?: FriendRealtimeService
): FriendRealtimeService {
  return override ?? observeBrowserService(supabaseFriendRealtimeService, "services.friendRealtime");
}

export function getNotificationCommandService(
  override?: NotificationCommandService
): NotificationCommandService {
  if (override) return override;
  notificationCommands ??= observeBrowserService(
    new SupabaseNotificationCommandService(createBrowserSupabaseClient()),
    "services.notificationCommands"
  );
  return notificationCommands;
}

export function getNotificationRealtimeService(
  override?: NotificationRealtimeService
): NotificationRealtimeService {
  return override ?? observeBrowserService(
    supabaseNotificationRealtimeService,
    "services.notificationRealtime"
  );
}

export function getAttentionRealtimeService(
  override?: AttentionRealtimeService
): AttentionRealtimeService {
  return override ?? observeBrowserService(
    supabaseAttentionRealtimeService,
    "services.attentionRealtime"
  );
}

export function getPresenceCommandService(
  override?: PresenceCommandService
): PresenceCommandService {
  if (override) return override;
  presenceCommands ??= observeBrowserService(
    new SupabasePresenceCommandService(createBrowserSupabaseClient()),
    "services.presenceCommands"
  );
  return presenceCommands;
}

export function getPresenceRealtimeService(
  override?: PresenceRealtimeService
): PresenceRealtimeService {
  return override ?? observeBrowserService(
    supabasePresenceRealtimeService,
    "services.presenceRealtime"
  );
}
