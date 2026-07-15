import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { z } from "npm:zod@4.4.3";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  ...corsHeaders,
};
const commandSchema = z.object({
  mode: z.enum(["automatic", "away", "busy", "invisible"]),
  durationSeconds: z.union([
    z.literal(900),
    z.literal(3_600),
    z.literal(28_800),
    z.literal(86_400),
    z.literal(259_200),
    z.null(),
  ]).optional().default(null),
});

function calmError(code: string, error: string, status: number): Response {
  return Response.json({ code, error }, { status, headers: jsonHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return calmError("method_not_allowed", "Use a post request to change status.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!publishableKey || !authHeader) {
    return calmError("not_authenticated", "Sign in to change your status.", 401);
  }

  const parsed = commandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return calmError("invalid_request", "Choose one of the available statuses.", 400);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  if (!userData.user) {
    return calmError("not_authenticated", "Sign in to change your status.", 401);
  }

  const { data, error } = await caller.rpc("set_presence_mode", {
    p_mode: parsed.data.mode,
    p_duration_seconds: parsed.data.durationSeconds,
  });
  if (error) {
    console.error("presence command failed", { code: error.code });
    return calmError(
      "presence_unavailable",
      "Your status could not change. Try again.",
      503,
    );
  }

  const row = data as {
    user_id: string;
    status: string;
    last_heartbeat_at: string | null;
    last_seen_at: string | null;
    revision: number;
    updated_at: string;
    preference_mode: string;
    preference_expires_at: string | null;
  };
  return Response.json({
    snapshot: {
      userId: row.user_id,
      status: row.status,
      lastHeartbeatAt: row.last_heartbeat_at,
      lastSeenAt: row.last_seen_at,
      revision: row.revision,
      updatedAt: row.updated_at,
    },
    setting: {
      preference: row.preference_mode,
      expiresAt: row.preference_expires_at,
    },
  }, { headers: jsonHeaders });
});
