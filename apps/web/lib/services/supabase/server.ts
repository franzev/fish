import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { Database } from "@fish/supabase";
import { cookies } from "next/headers";
import {
  getPublicEnv,
  isAppPublicEnv,
  type AppPublicEnv,
  type EnvSource,
} from "../env";
import { createSupabaseServices } from "./core";
import type { AppServices } from "../contracts";
import type {
  AppSupabaseClient,
  CookieToSet,
  MutableCookieStore,
} from "./types";

export interface ServerSupabaseClientDeps {
  env?: AppPublicEnv | EnvSource;
  createClient?: typeof createServerClient;
  cookieWriteMode?: "suppress-server-component-errors" | "strict";
}

function resolveEnv(env?: AppPublicEnv | EnvSource): AppPublicEnv {
  if (isAppPublicEnv(env)) {
    return env;
  }
  return getPublicEnv(env);
}

/**
 * Shared Server Component / Server Action / Route Handler factory. It accepts
 * a cookie store instead of reading global Next state, which keeps the service
 * easy to test and lets API handlers pass request-scoped cookies explicitly.
 */
export function createServerSupabaseClientFromCookies(
  cookieStore: MutableCookieStore,
  deps: ServerSupabaseClientDeps = {}
): AppSupabaseClient {
  const env = resolveEnv(deps.env);
  const factory = deps.createClient ?? createServerClient;
  const cookieWriteMode =
    deps.cookieWriteMode ?? "suppress-server-component-errors";

  return factory<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (error) {
          if (cookieWriteMode === "strict") {
            throw error;
          }
          // Server Components cannot always write cookies. The proxy refreshes
          // the same session on navigation, so this mirrors @supabase/ssr's
          // documented Next.js App Router pattern.
        }
      },
    },
  });
}

export function createServerSupabaseServicesFromCookies(
  cookieStore: MutableCookieStore,
  deps: ServerSupabaseClientDeps = {}
): AppServices {
  return createSupabaseServices(
    createServerSupabaseClientFromCookies(cookieStore, deps)
  );
}

export async function createServerSupabaseClient(
  deps: ServerSupabaseClientDeps = {}
): Promise<AppSupabaseClient> {
  return createServerSupabaseClientFromCookies(await cookies(), deps);
}

export async function createServerSupabaseServices(
  deps: ServerSupabaseClientDeps = {}
): Promise<AppServices> {
  return createSupabaseServices(await createServerSupabaseClient(deps));
}
