import type { ChatConversation, ChatMessage } from "@fish/core/chat";
import type { UserRole } from "@fish/core/roles";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ProfileRow {
  id: string;
  role: UserRole;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at" | "updated_at">;
        Update: Partial<Omit<ProfileRow, "id">>;
      };
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
    };
  };
}
