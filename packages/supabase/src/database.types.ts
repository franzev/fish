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
export type MessageReadRow = Database["public"]["Tables"]["message_reads"]["Row"];
export type MessageReactionRow =
  Database["public"]["Tables"]["message_reactions"]["Row"];
export type PresenceSessionRow =
  Database["public"]["Tables"]["presence_sessions"]["Row"];

// Re-exported for callers that still import UserRole via this module's historical surface.
export type { UserRole };
