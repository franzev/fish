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

const ids = z.array(z.uuid()).min(1).max(100);
const snapshot = z.number().int().nonnegative();
const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["mark-seen", "mark-read"]),
    notificationIds: ids,
    throughChangeSeq: snapshot,
  }),
  z.object({
    action: z.enum(["mark-all-read", "archive-read"]),
    throughChangeSeq: snapshot,
  }),
  z.object({ action: z.literal("restore"), archiveBatchId: z.uuid() }),
  z.object({ action: z.literal("acknowledge-moderation"), moderationActionId: z.uuid() }),
]);

function calmError(code: string, error: string, status: number): Response {
  return Response.json({ code, error }, { status, headers: jsonHeaders });
}

function rpcError(message: string): Response {
  const normalized = message.toLowerCase();
  if (normalized.includes("not authenticated")) {
    return calmError("not_authenticated", "Sign in to update notifications.", 401);
  }
  if (normalized.includes("invalid") || normalized.includes("too many")) {
    return calmError("invalid_request", "That notification update is not ready yet.", 400);
  }
  return calmError(
    "notifications_unavailable",
    "Notifications could not update. Your messages are still here.",
    503,
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return calmError("method_not_allowed", "Use a post request for notifications.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!publishableKey || !authHeader) {
    return calmError("not_authenticated", "Sign in to update notifications.", 401);
  }

  const parsed = commandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return calmError("invalid_request", "That notification update is not ready yet.", 400);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  if (!userData.user) {
    return calmError("not_authenticated", "Sign in to update notifications.", 401);
  }

  const command = parsed.data;
  const dispatch = command.action === "mark-seen"
    ? {
      rpc: "mark_notifications_seen",
      args: {
        p_notification_ids: command.notificationIds,
        p_through_change_seq: command.throughChangeSeq,
      },
    }
    : command.action === "mark-read"
    ? {
      rpc: "mark_notifications_read",
      args: {
        p_notification_ids: command.notificationIds,
        p_through_change_seq: command.throughChangeSeq,
      },
    }
    : command.action === "mark-all-read"
    ? {
      rpc: "mark_all_notifications_read",
      args: { p_through_change_seq: command.throughChangeSeq },
    }
    : command.action === "archive-read"
    ? {
      rpc: "archive_read_notifications",
      args: { p_through_change_seq: command.throughChangeSeq },
    }
    : command.action === "restore"
    ? {
      rpc: "restore_notification_batch",
      args: { p_archive_batch_id: command.archiveBatchId },
    }
    : {
      rpc: "acknowledge_moderation_action",
      args: { p_action_id: command.moderationActionId },
    };

  const { data, error } = await caller.rpc(dispatch.rpc, dispatch.args);
  if (error) {
    console.error("notification command failed", {
      action: command.action,
      code: error.code,
    });
    return rpcError(error.message);
  }

  const archiveResult = command.action === "archive-read" &&
      typeof data === "object" && data !== null
    ? data as { updated?: number; archiveBatchId?: string }
    : null;
  return Response.json(
    {
      updated: archiveResult?.updated ?? (
        typeof data === "number" ? data : data === true ? 1 : 0
      ),
      ...(archiveResult?.archiveBatchId
        ? { archiveBatchId: archiveResult.archiveBatchId }
        : {}),
    },
    { headers: jsonHeaders },
  );
});
