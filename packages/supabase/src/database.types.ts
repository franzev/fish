import type { UserRole } from "@fish/core/roles";
import type { Database as GeneratedDatabase, Json } from "./database.generated";

export type { Json };

// Canonical Database type: re-exports the generated schema (profiles, coach_clients --
// real migrated tables only). Regenerating database.generated.ts (via `supabase gen
// types`) never requires touching this file.
export type Database = GeneratedDatabase;

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type CoachClientRow = Database["public"]["Tables"]["coach_clients"]["Row"];
export type ClientProfileRow = Database["public"]["Tables"]["client_profiles"]["Row"];
export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type MessageAttachmentRow =
  Database["public"]["Tables"]["message_attachments"]["Row"];
export type MessageGifRow = Database["public"]["Tables"]["message_gifs"]["Row"];
export type MessageReadRow = Database["public"]["Tables"]["message_reads"]["Row"];
export type MessageReactionRow =
  Database["public"]["Tables"]["message_reactions"]["Row"];
export type PresenceSessionRow =
  Database["public"]["Tables"]["presence_sessions"]["Row"];
export type PresencePreferenceRow =
  Database["public"]["Tables"]["presence_preferences"]["Row"];
export type PresenceSnapshotRow =
  Database["public"]["Tables"]["presence_snapshots"]["Row"];
export type CallRow = Database["public"]["Tables"]["calls"]["Row"];
export type CallParticipantRow =
  Database["public"]["Tables"]["call_participants"]["Row"];
export type CallEventRow =
  Database["public"]["Tables"]["call_events"]["Row"];
export type FriendRequestRow =
  Database["public"]["Tables"]["friend_requests"]["Row"];
export type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
export type UserBlockRow = Database["public"]["Tables"]["user_blocks"]["Row"];
export type UserNotificationRow =
  Database["public"]["Tables"]["user_notifications"]["Row"];
export type NotificationItemRow =
  Database["public"]["Tables"]["notification_items"]["Row"];
export type NotificationEventRow =
  Database["public"]["Tables"]["notification_events"]["Row"];
export type SystemAnnouncementRow =
  Database["public"]["Tables"]["system_announcements"]["Row"];
export type ModerationActionRow =
  Database["public"]["Tables"]["moderation_actions"]["Row"];

// Re-exported for callers that still import UserRole via this module's historical surface.
export type { UserRole };
