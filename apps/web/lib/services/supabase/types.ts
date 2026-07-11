import type { Database } from "@fish/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

export type AppSupabaseClient = SupabaseClient<Database>;
export interface CookieToSet { name: string; value: string; options: CookieOptions }
export interface MutableCookieStore {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: CookieOptions): void;
}

export type {
  AppServices,
  AuthService as SupabaseAuthService,
  ChatRepository,
  ClientChatData,
  ClientChatMessage,
  ClientChatPresenceSession,
  ClientChatReadState,
  ClientProfileRecord as ClientProfileRow,
  ClientProfileRepository,
  ClientProfileSafeFields,
  CoachClientListItem,
  CoachClientRepository,
  DatabaseServices as SupabaseDatabaseService,
  ProfileRepository,
} from "../contracts";
