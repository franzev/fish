import type { ChatConversation, ChatMessage } from "@fish/core/chat";
import type { UserRole } from "@fish/core/roles";
import type { Database as GeneratedDatabase, Json } from "./database.generated";

export type { Json };

// Canonical Database type: re-exports the generated schema (profiles, coach_clients --
// real migrated tables only). Regenerating database.generated.ts (via `supabase gen
// types`) never requires touching this file.
export type Database = GeneratedDatabase;

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type CoachClientRow = Database["public"]["Tables"]["coach_clients"]["Row"];

// NOT YET MIGRATED -- chat is a future phase; these are hand-written contracts, not live
// DB tables. Keep them out of `Database` so nothing treats conversations/messages as real
// tables that `supabase gen types` would ever produce.
export interface LegacyChatContracts {
  conversations: {
    Row: ChatConversation;
    Insert: Omit<ChatConversation, "createdAt" | "updatedAt">;
    Update: Partial<Pick<ChatConversation, "clientId" | "coachId">>;
  };
  messages: {
    Row: ChatMessage;
    Insert: Omit<ChatMessage, "id" | "createdAt">;
    Update: never;
  };
}

// Re-exported for callers that still import UserRole via this module's historical surface.
export type { UserRole };
