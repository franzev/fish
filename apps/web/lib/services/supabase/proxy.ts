import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getPublicEnv,
  isAppPublicEnv,
  type AppPublicEnv,
  type EnvSource,
} from "../env";
import { createSupabaseServices } from "./core";
import { createServerSupabaseClientFromCookies } from "./server";

export interface ProxySupabaseDeps {
  env?: AppPublicEnv | EnvSource;
  createClient?: typeof createServerClient;
  next?: typeof NextResponse.next;
}

/**
 * Middleware/proxy entrypoint. It owns the fragile Supabase cookie-refresh
 * sequence in one place so route guards and pages do not duplicate it.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  deps: ProxySupabaseDeps = {}
): Promise<NextResponse> {
  let response = (deps.next ?? NextResponse.next)({ request });
  const env = isAppPublicEnv(deps.env) ? deps.env : getPublicEnv(deps.env);

  const client = createServerSupabaseClientFromCookies(
    {
      getAll() {
        return request.cookies.getAll();
      },
      set(name, value, options) {
        request.cookies.set(name, value);
        // NextResponse snapshots request headers when it is created. Rebuild
        // after request cookie writes so downstream Server Components render
        // against the refreshed session during this same navigation.
        response = (deps.next ?? NextResponse.next)({ request });
        response.cookies.set(name, value, options);
      },
    },
    {
      env,
      createClient: deps.createClient,
      cookieWriteMode: "strict",
    }
  );

  const result = await createSupabaseServices(client).auth.refreshSessionClaims();
  if (!result.ok) {
    throw result.error;
  }

  return response;
}
