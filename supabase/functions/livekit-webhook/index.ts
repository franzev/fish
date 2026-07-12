import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { WebhookReceiver } from "npm:livekit-server-sdk@2.17.0";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

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
  const { data: call } = await admin.from("calls").select("id,status")
    .eq("provider_room_name", roomName).maybeSingle();
  if (!call) {
    return Response.json({ received: true }, { headers: jsonHeaders });
  }

  const occurredAt = new Date().toISOString();
  const participantId = event.participant?.identity;
  const providerEventId = event.id || null;
  if (providerEventId) {
    const inserted = await admin.from("call_events").insert({
      call_id: call.id,
      provider_event_id: providerEventId,
      event_type: event.event,
      actor_id: participantId || null,
      occurred_at: occurredAt,
      metadata: {},
    });
    if (inserted.error?.code === "23505") {
      return Response.json({ received: true }, { headers: jsonHeaders });
    }
    if (inserted.error) {
      return Response.json({ error: "event_store_failed" }, {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  if (event.event === "participant_joined" && participantId) {
    await admin.from("call_participants").update({
      joined_at: occurredAt,
      left_at: null,
      updated_at: occurredAt,
    }).eq("call_id", call.id).eq("user_id", participantId);

    const { count } = await admin.from("call_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("call_id", call.id).not("joined_at", "is", null)
      .is("left_at", null);
    if ((count ?? 0) >= 2 && call.status === "connecting") {
      await admin.from("calls").update({
        status: "active",
        connected_at: occurredAt,
        updated_at: occurredAt,
      }).eq("id", call.id).eq("status", "connecting");
    }
  }

  if (
    (event.event === "participant_left" ||
      event.event === "participant_connection_aborted") && participantId
  ) {
    await admin.from("call_participants").update({
      left_at: occurredAt,
      updated_at: occurredAt,
    }).eq("call_id", call.id).eq("user_id", participantId);

    await admin.from("calls").update({
      status: "failed",
      ended_at: occurredAt,
      end_reason: "network_lost",
      updated_at: occurredAt,
    }).eq("id", call.id).in("status", ["connecting", "active"]);
  }

  if (event.event === "room_finished") {
    await admin.from("calls").update({
      status: "failed",
      ended_at: occurredAt,
      end_reason: "provider_error",
      updated_at: occurredAt,
    }).eq("id", call.id).in("status", ["ringing", "connecting", "active"]);
  }

  return Response.json({ received: true }, { headers: jsonHeaders });
});
