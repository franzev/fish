import { SupabaseAuthServiceImpl } from "./auth";
import {
  SupabaseDatabaseServiceImpl,
  SupabaseRealtimeServiceImpl,
  SupabaseStorageServiceImpl,
} from "./runtime-services";
import type { AppSupabaseClient, SupabaseServices } from "./types";

/**
 * One factory builds the cohesive Supabase registry for every runtime. This is
 * the DI seam: tests can inject a fake client, and future services can compose
 * against interfaces instead of importing Supabase directly.
 */
export function createSupabaseServices(
  client: AppSupabaseClient
): SupabaseServices {
  return {
    client,
    auth: new SupabaseAuthServiceImpl(client),
    database: new SupabaseDatabaseServiceImpl(client),
    storage: new SupabaseStorageServiceImpl(client),
    realtime: new SupabaseRealtimeServiceImpl(client),
  };
}
