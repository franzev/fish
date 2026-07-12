import { SupabaseAuthServiceImpl } from "./auth";
import { SupabaseDatabaseServiceImpl } from "./runtime-services";
import { SupabaseAvatarCommandService } from "./avatar-command-service";
import type { AppServices } from "../contracts";
import type { AppSupabaseClient } from "./types";

/**
 * One factory builds the cohesive Supabase registry for every runtime. This is
 * the DI seam: tests can inject a fake client, and future services can compose
 * against interfaces instead of importing Supabase directly.
 */
export function createSupabaseServices(
  client: AppSupabaseClient
): AppServices {
  return {
    auth: new SupabaseAuthServiceImpl(client),
    database: new SupabaseDatabaseServiceImpl(client),
    avatars: new SupabaseAvatarCommandService(client),
  };
}
