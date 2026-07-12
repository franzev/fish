import {
  AccessToken,
  TrackSource,
} from "npm:livekit-server-sdk@2.17.0";
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
    action: z.literal("initiate"),
    recipientId: z.uuid(),
    kind: z.enum(["audio", "video"]),
    clientRequestId: z.string().trim().min(1).max(128),
  }),
  z.object({ action: z.literal("accept"), callId: z.uuid() }),
  z.object({ action: z.literal("reject"), callId: z.uuid() }),
  z.object({ action: z.literal("cancel"), callId: z.uuid() }),
  z.object({ action: z.literal("end"), callId: z.uuid() }),
  z.object({ action: z.literal("join"), callId: z.uuid() }),
]);

type CallRow = {
  id: string;
  coach_id: string;
  client_id: string;
  initiated_by: string;
  kind: "audio" | "video";
  status:
    | "ringing"
    | "connecting"
    | "active"
    | "ended"
    | "rejected"
    | "cancelled"
    | "missed"
    | "failed";
  provider_room_name: string;
  expires_at: string;
  accepted_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  created_at: string;
  updated_at: string;
};

function calmError(code: string, error: string, status: number): Response {
  return Response.json({ code, error }, { status, headers: jsonHeaders });
}

function unwrapCall(value: unknown): CallRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  return typeof row === "object" && row !== null ? row as CallRow : null;
}

function clientCall(call: CallRow) {
  return {
    id: call.id,
    coachId: call.coach_id,
    clientId: call.client_id,
    initiatedBy: call.initiated_by,
    kind: call.kind,
    status: call.status,
    expiresAt: call.expires_at,
    acceptedAt: call.accepted_at,
    connectedAt: call.connected_at,
    endedAt: call.ended_at,
    endReason: call.end_reason,
    createdAt: call.created_at,
    updatedAt: call.updated_at,
  };
}

function rpcError(message: string): Response {
  const normalized = message.toLowerCase();
  if (normalized.includes("participant busy")) {
    return calmError(
      "participant_busy",
      "They’re already in a call. Try again a little later.",
      409,
    );
  }
  if (normalized.includes("rate limited")) {
    return calmError(
      "call_rate_limited",
      "Pause for a moment before trying another call.",
      429,
    );
  }
  if (normalized.includes("already finished")) {
    return calmError("call_already_finished", "This call has ended.", 409);
  }
  if (normalized.includes("not allowed") || normalized.includes("not found")) {
    return calmError(
      "call_not_allowed",
      "This call is no longer available.",
      403,
    );
  }
  if (normalized.includes("conflicts")) {
    return calmError(
      "request_conflict",
      "That call request is already in progress.",
      409,
    );
  }
  return calmError(
    "call_unavailable",
    "Calling is taking a break. Messages still work.",
    503,
  );
}

async function connectionFor(call: CallRow, userId: string) {
  const serverUrl = Deno.env.get("LIVEKIT_URL")?.trim();
  const apiKey = Deno.env.get("LIVEKIT_API_KEY")?.trim();
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")?.trim();
  if (!serverUrl || !apiKey || !apiSecret) return null;

  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    ttl: "5m",
  });
  token.addGrant({
    roomJoin: true,
    room: call.provider_room_name,
    canSubscribe: true,
    canPublish: true,
    canPublishData: false,
    canPublishSources: call.kind === "video"
      ? [TrackSource.MICROPHONE, TrackSource.CAMERA]
      : [TrackSource.MICROPHONE],
  });

  return { serverUrl, participantToken: await token.toJwt() };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return calmError("method_not_allowed", "Use a post request for calls.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!publishableKey || !authHeader) {
    return calmError("not_authenticated", "Sign in before starting a call.", 401);
  }

  const parsed = commandSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return calmError("invalid_request", "That call request is not ready yet.", 400);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const user = userData.user;
  if (!user) {
    return calmError("not_authenticated", "Sign in before starting a call.", 401);
  }

  const command = parsed.data;
  const rpcName = command.action === "initiate"
    ? "initiate_call"
    : command.action === "accept"
    ? "accept_call"
    : command.action === "reject"
    ? "reject_call"
    : command.action === "cancel"
    ? "cancel_call"
    : command.action === "end"
    ? "end_call"
    : "join_call";
  const args = command.action === "initiate"
    ? {
      p_recipient_id: command.recipientId,
      p_kind: command.kind,
      p_client_request_id: command.clientRequestId,
    }
    : { p_call_id: command.callId };

  const { data, error } = await caller.rpc(rpcName, args);
  if (error) {
    console.error("call command failed", {
      action: command.action,
      code: error.code,
    });
    return rpcError(error.message);
  }

  const call = unwrapCall(data);
  if (!call) {
    return calmError(
      "call_unavailable",
      "Calling is taking a break. Messages still work.",
      503,
    );
  }
  if (command.action === "accept" && call.status === "missed") {
    return calmError("call_already_finished", "This call has ended.", 409);
  }

  const needsConnection = command.action === "accept" ||
    command.action === "join";
  const connection = needsConnection
    ? await connectionFor(call, user.id)
    : undefined;
  if (needsConnection && !connection) {
    return calmError(
      "media_unavailable",
      "Calling is taking a break. Messages still work.",
      503,
    );
  }

  return Response.json(
    { call: clientCall(call), ...(connection ? { connection } : {}) },
    { headers: jsonHeaders },
  );
});
