import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { WebhookReceiver } from "npm:livekit-server-sdk@2.17.0";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function isUuid(value: string | undefined): value is string {
  return !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

function eventTime(createdAt: bigint): string {
  const seconds = Number(createdAt);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1_000).toISOString()
    : new Date().toISOString();
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const apiKey = Deno.env.get("LIVEKIT_API_KEY")?.trim();
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !apiSecret || !serviceKey) {
    return Response.json({ error: "webhook_unavailable" }, {
      status: 503,
      headers: jsonHeaders,
    });
  }

  let event;
  try {
    event = await new WebhookReceiver(apiKey, apiSecret).receive(
      await request.text(),
      request.headers.get("Authorization") ?? undefined,
    );
  } catch {
    return Response.json({ error: "invalid_signature" }, {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const roomName = event.room?.name;
  if (!roomName) {
    return Response.json({ received: true }, { headers: jsonHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const participantIdentity = event.participant?.identity;
  const participantId = isUuid(participantIdentity)
    ? participantIdentity
    : null;
  const participantSid = event.participant?.sid || null;
  const occurredAt = eventTime(event.createdAt);
  const providerEventId = event.id || [
    roomName,
    event.event,
    participantSid ?? "room",
    occurredAt,
  ].join(":");
  const { error } = await admin.rpc("reconcile_livekit_webhook", {
    p_provider_event_id: providerEventId,
    p_room_name: roomName,
    p_event_type: event.event,
    p_participant_id: participantId,
    p_participant_sid: participantSid,
    p_occurred_at: occurredAt,
  });
  if (error) {
    console.error("livekit webhook reconciliation failed", {
      code: error.code,
      eventType: event.event,
    });
    return Response.json({ error: "event_reconciliation_failed" }, {
      status: 500,
      headers: jsonHeaders,
    });
  }

  return Response.json({ received: true }, { headers: jsonHeaders });
});
