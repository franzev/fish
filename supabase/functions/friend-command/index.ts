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
    action: z.literal("send-request"),
    targetId: z.uuid(),
    clientRequestId: z.string().trim().min(1).max(128),
  }),
  z.object({
    action: z.literal("respond-request"),
    requestId: z.uuid(),
    response: z.enum(["accept", "decline"]),
  }),
  z.object({ action: z.literal("cancel-request"), requestId: z.uuid() }),
  z.object({ action: z.literal("remove-friend"), targetId: z.uuid() }),
  z.object({ action: z.literal("block-user"), targetId: z.uuid() }),
  z.object({ action: z.literal("unblock-user"), targetId: z.uuid() }),
  z.object({
    action: z.literal("mark-notifications-read"),
    notificationIds: z.array(z.uuid()).min(1).max(100),
  }),
]);

type FriendRequestRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

function calmError(code: string, error: string, status: number): Response {
  return Response.json({ code, error }, { status, headers: jsonHeaders });
}

function unwrapRequest(value: unknown): FriendRequestRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  return typeof row === "object" && row !== null ? row as FriendRequestRow : null;
}

function clientRequest(request: FriendRequestRow) {
  return {
    id: request.id,
    senderId: request.sender_id,
    recipientId: request.recipient_id,
    status: request.status,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
    respondedAt: request.responded_at,
  };
}

function rpcError(message: string): Response {
  const normalized = message.toLowerCase();
  if (normalized.includes("already friends")) {
    return calmError("already_friends", "You’re already friends.", 409);
  }
  if (normalized.includes("incoming request exists")) {
    return calmError(
      "incoming_request_exists",
      "They already sent you a request. Review it when you’re ready.",
      409,
    );
  }
  if (normalized.includes("request pending")) {
    return calmError("request_pending", "Your request is already on its way.", 409);
  }
  if (normalized.includes("already resolved")) {
    return calmError(
      "request_already_resolved",
      "This request was already handled.",
      409,
    );
  }
  if (normalized.includes("rate limited")) {
    return calmError(
      "rate_limited",
      "Pause for a moment before sending more requests.",
      429,
    );
  }
  if (normalized.includes("conflicts")) {
    return calmError(
      "request_conflict",
      "That friend request is already in progress.",
      409,
    );
  }
  if (normalized.includes("friends not available")) {
    return calmError(
      "friends_unavailable",
      "Friends isn’t available for this account.",
      403,
    );
  }
  if (normalized.includes("request not found")) {
    return calmError(
      "request_not_found",
      "This request isn’t available anymore.",
      404,
    );
  }
  if (
    normalized.includes("unavailable") ||
    normalized.includes("not found")
  ) {
    return calmError("person_unavailable", "That person isn’t available.", 404);
  }
  if (normalized.includes("not authenticated")) {
    return calmError("not_authenticated", "Sign in to manage friends.", 401);
  }
  return calmError(
    "friends_unavailable",
    "Friends is taking a break. Chat still works.",
    503,
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return calmError(
      "method_not_allowed",
      "Use a post request for friends.",
      405,
    );
  }

  // Server-side pilot gate: set FRIENDS_ENABLED=false to pause the feature
  // without a client deploy while coach validation is in progress.
  if (Deno.env.get("FRIENDS_ENABLED")?.trim().toLowerCase() === "false") {
    return calmError(
      "friends_unavailable",
      "Friends is taking a break. Chat still works.",
      503,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!publishableKey || !authHeader) {
    return calmError("not_authenticated", "Sign in to manage friends.", 401);
  }

  const parsed = commandSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return calmError("invalid_request", "That request is not ready yet.", 400);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  if (!userData.user) {
    return calmError("not_authenticated", "Sign in to manage friends.", 401);
  }

  const command = parsed.data;
  const dispatch = command.action === "send-request"
    ? {
      rpc: "send_friend_request",
      args: {
        p_target_id: command.targetId,
        p_client_request_id: command.clientRequestId,
      },
    }
    : command.action === "respond-request"
    ? {
      rpc: "respond_friend_request",
      args: { p_request_id: command.requestId, p_response: command.response },
    }
    : command.action === "cancel-request"
    ? { rpc: "cancel_friend_request", args: { p_request_id: command.requestId } }
    : command.action === "remove-friend"
    ? { rpc: "remove_friend", args: { p_target_id: command.targetId } }
    : command.action === "block-user"
    ? { rpc: "block_user", args: { p_target_id: command.targetId } }
    : command.action === "unblock-user"
    ? { rpc: "unblock_user", args: { p_target_id: command.targetId } }
    : {
      rpc: "mark_friend_notifications_read",
      args: { p_notification_ids: command.notificationIds },
    };

  const { data, error } = await caller.rpc(dispatch.rpc, dispatch.args);
  if (error) {
    console.error("friend command failed", {
      action: command.action,
      code: error.code,
    });
    return rpcError(error.message);
  }

  if (
    command.action === "send-request" ||
    command.action === "respond-request" ||
    command.action === "cancel-request"
  ) {
    const friendRequest = unwrapRequest(data);
    if (!friendRequest) {
      return calmError(
        "friends_unavailable",
        "Friends is taking a break. Chat still works.",
        503,
      );
    }
    return Response.json(
      { request: clientRequest(friendRequest) },
      { headers: jsonHeaders },
    );
  }

  if (command.action === "mark-notifications-read") {
    return Response.json(
      { updated: typeof data === "number" ? data : 0 },
      { headers: jsonHeaders },
    );
  }

  return Response.json(
    { done: data !== false },
    { headers: jsonHeaders },
  );
});
