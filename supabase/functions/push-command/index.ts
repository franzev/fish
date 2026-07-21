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
const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register"),
    installationId: z.uuid(),
    providerInstallationId: z.string().trim().min(8).max(256),
    platform: z.enum(["android", "ios"]),
    appVersion: z.string().trim().min(1).max(64),
  }),
  z.object({
    action: z.literal("register_voip"),
    installationId: z.uuid(),
    providerInstallationId: z.string().trim().min(8).max(256),
    platform: z.literal("ios"),
    appVersion: z.string().trim().min(1).max(64),
  }),
  z.object({
    action: z.literal("unregister"),
    installationId: z.uuid(),
  }),
  z.object({
    action: z.literal("unregister_voip"),
    installationId: z.uuid(),
  }),
]);

function calmError(code: string, error: string, status: number): Response {
  return Response.json({ code, error }, { status, headers: jsonHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return calmError("method_not_allowed", "Use a post request for notifications.", 405);
  }

  const parsed = commandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return calmError("invalid_request", "Notifications are not ready yet.", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!publishableKey || !authHeader) {
    return calmError("not_authenticated", "Sign in to use notifications.", 401);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  if (!userData.user) {
    return calmError("not_authenticated", "Sign in to use notifications.", 401);
  }

  const command = parsed.data;
  const { error } = command.action === "register"
    ? await caller.rpc("register_push_device", {
      p_installation_id: command.installationId,
      p_provider_installation_id: command.providerInstallationId,
      p_platform: command.platform,
      p_app_version: command.appVersion,
    })
    : command.action === "register_voip"
    ? await caller.rpc("register_voip_push_device", {
      p_installation_id: command.installationId,
      p_provider_installation_id: command.providerInstallationId,
      p_app_version: command.appVersion,
    })
    : command.action === "unregister_voip"
    ? await caller.rpc("unregister_voip_push_device", {
      p_installation_id: command.installationId,
    })
    : await caller.rpc("unregister_push_device", {
      p_installation_id: command.installationId,
    });

  if (error) {
    console.error("push command failed", { action: command.action, code: error.code });
    return calmError(
      "push_unavailable",
      "Notifications could not update. Messages still work in the app.",
      503,
    );
  }

  return Response.json({ ok: true }, { headers: jsonHeaders });
});
