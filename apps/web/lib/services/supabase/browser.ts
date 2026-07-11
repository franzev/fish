import "client-only";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@fish/supabase";
import {
  getPublicEnv,
  isAppPublicEnv,
  type AppPublicEnv,
  type EnvSource,
} from "../env";
import { createSupabaseServices } from "./core";
import type { AppSupabaseClient, SupabaseServices } from "./types";

export interface BrowserSupabaseClientDeps {
  env?: AppPublicEnv | EnvSource;
  createClient?: typeof createBrowserClient;
}

function resolveEnv(env?: AppPublicEnv | EnvSource): AppPublicEnv {
  if (isAppPublicEnv(env)) {
    return env;
  }
  return getPublicEnv(env);
}

/**
 * Browser entrypoint only. Keep this separate from server/proxy factories so a
 * Client Component never pulls `next/headers` or middleware-only code into its
 * bundle by accident.
 */
export function createBrowserSupabaseClient(
  deps: BrowserSupabaseClientDeps = {}
): AppSupabaseClient {
  const env = resolveEnv(deps.env);
  const factory = deps.createClient ?? createBrowserClient;

  return factory<Database>(env.supabaseUrl, env.supabasePublishableKey);
}

export function createBrowserSupabaseServices(
  deps: BrowserSupabaseClientDeps = {}
): SupabaseServices {
  return createSupabaseServices(createBrowserSupabaseClient(deps));
}
