// Live call-control verification through authenticated sessions and signed
// provider webhooks. Browser media publication is covered by Playwright.
import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const livekitApiKey = process.env.LIVEKIT_API_KEY;
const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

if (
  !supabaseUrl ||
  !publishableKey ||
  !serviceRoleKey ||
  !livekitApiKey ||
  !livekitApiSecret
) {
  console.error(
    "Missing local Supabase or LiveKit settings. Run `supabase start` and configure the web and function env files.",
  );
  process.exit(1);
}

const users = {
  coach: { email: "coach@fish.dev", password: "fish-coach-dev" },
  client: { email: "client1@fish.dev", password: "fish-client-dev" },
  friend: { email: "client2@fish.dev", password: "fish-client-dev" },
  unrelatedCoach: { email: "coach2@fish.dev", password: "fish-coach-dev" },
};

let failures = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function signIn(email: string, password: string) {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Could not sign in ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

async function sendLiveKitWebhook(input: {
  eventId: string;
  eventType: string;
  roomName: string;
  participantId: string | null;
  participantSid: string | null;
  occurredAt: Date;
}) {
  const body = JSON.stringify({
    id: input.eventId,
    event: input.eventType,
    createdAt: String(Math.floor(input.occurredAt.getTime() / 1_000)),
    room: { sid: "RM_fish_verification", name: input.roomName },
    ...(input.participantId && input.participantSid
      ? {
          participant: {
            identity: input.participantId,
            sid: input.participantSid,
          },
        }
      : {}),
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(body),
  );
  const token = new AccessToken(livekitApiKey!, livekitApiSecret!);
  token.sha256 = Buffer.from(digest).toString("base64");
  const response = await fetch(`${supabaseUrl}/functions/v1/livekit-webhook`, {
    method: "POST",
    headers: {
      Authorization: await token.toJwt(),
      "content-type": "application/webhook+json",
    },
    body,
  });
  return {
    error: response.ok
      ? null
      : { message: `${response.status}: ${await response.text()}` },
  };
}

async function main() {
  const coach = await signIn(users.coach.email, users.coach.password);
  const client = await signIn(users.client.email, users.client.password);
  const friend = await signIn(users.friend.email, users.friend.password);
  const unrelated = await signIn(
    users.unrelatedCoach.email,
    users.unrelatedCoach.password,
  );
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await client.client.realtime.setAuth();
  let resolveBroadcast: (payload: { callId?: string } | null) => void;
  const broadcastReceived = new Promise<{ callId?: string } | null>((resolve) => {
    resolveBroadcast = resolve;
  });
  let resolveSubscription: (ready: boolean) => void;
  const subscriptionReady = new Promise<boolean>((resolve) => {
    resolveSubscription = resolve;
  });
  const callChannel = client.client
    .channel(`calls:user:${client.userId}`, { config: { private: true } })
    .on("broadcast", { event: "call.changed" }, ({ payload }) => {
      resolveBroadcast(payload as { callId?: string });
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") resolveSubscription(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        resolveSubscription(false);
      }
    });
  const realtimeReady = await Promise.race([
    subscriptionReady,
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  report("invitee can authorize a private call topic", realtimeReady);

  const clientRequestId = crypto.randomUUID();
  const [firstInitiate, secondInitiate] = await Promise.all([
    coach.client.rpc("initiate_call", {
      p_recipient_id: client.userId,
      p_kind: "audio",
      p_client_request_id: clientRequestId,
    }),
    coach.client.rpc("initiate_call", {
      p_recipient_id: client.userId,
      p_kind: "audio",
      p_client_request_id: clientRequestId,
    }),
  ]);
  const call = firstInitiate.data ?? secondInitiate.data;
  report(
    "assigned coach can initiate an audio call",
    !firstInitiate.error && call?.status === "ringing",
    firstInitiate.error?.message,
  );
  report(
    "concurrent retries return the same canonical call",
    !firstInitiate.error &&
      !secondInitiate.error &&
      firstInitiate.data?.id === secondInitiate.data?.id,
    firstInitiate.error?.message ?? secondInitiate.error?.message,
  );
  if (!call) throw new Error("Cannot continue without an initiated call");

  const broadcast = await Promise.race([
    broadcastReceived,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
  ]);
  report(
    "invitee receives the call wakeup broadcast",
    broadcast?.callId === call.id,
    broadcast ? JSON.stringify(broadcast) : "timed out",
  );

  const { data: visibleCall, error: participantReadError } = await client.client
    .from("calls")
    .select("id,status")
    .eq("id", call.id)
    .maybeSingle();
  report(
    "participant can read the call",
    !participantReadError && visibleCall?.id === call.id,
    participantReadError?.message,
  );

  const { data: callerName, error: callerNameError } = await client.client.rpc(
    "get_call_counterpart_name",
    { p_call_id: call.id },
  );
  report(
    "invitee can resolve the caller name",
    !callerNameError && callerName === "Patty Cake",
    callerNameError?.message,
  );

  const { data: leakedCall, error: unrelatedReadError } = await unrelated.client
    .from("calls")
    .select("id")
    .eq("id", call.id);
  report(
    "unrelated user cannot read the call",
    !unrelatedReadError && leakedCall?.length === 0,
    unrelatedReadError?.message,
  );

  const { data: leakedCallerName, error: leakedCallerNameError } =
    await unrelated.client.rpc("get_call_counterpart_name", {
      p_call_id: call.id,
    });
  report(
    "unrelated user cannot resolve a call participant name",
    !leakedCallerNameError && leakedCallerName === null,
    leakedCallerNameError?.message,
  );

  const { error: unauthorizedAcceptError } = await unrelated.client.rpc("accept_call", {
    p_call_id: call.id,
  });
  report("unrelated user cannot accept the call", !!unauthorizedAcceptError);

  const { error: callerEarlyJoinError } = await coach.client.rpc("join_call", {
    p_call_id: call.id,
  });
  const { error: inviteeEarlyJoinError } = await client.client.rpc("join_call", {
    p_call_id: call.id,
  });
  report(
    "participants cannot join media before acceptance",
    !!callerEarlyJoinError && !!inviteeEarlyJoinError,
  );

  const { error: directInsertError } = await client.client.from("calls").insert({
    coach_id: coach.userId,
    client_id: client.userId,
    initiated_by: client.userId,
    kind: "audio",
    status: "ringing",
    provider: "livekit",
    provider_room_name: `forbidden-${crypto.randomUUID()}`,
    client_request_id: crypto.randomUUID(),
    expires_at: new Date(Date.now() + 45_000).toISOString(),
  });
  report("authenticated direct lifecycle writes are denied", !!directInsertError);

  const { error: unrelatedInitiateError } = await unrelated.client.rpc("initiate_call", {
    p_recipient_id: client.userId,
    p_kind: "audio",
    p_client_request_id: crypto.randomUUID(),
  });
  report("unassigned coach cannot call the client", !!unrelatedInitiateError);

  const { data: accepted, error: acceptError } = await client.client.rpc("accept_call", {
    p_call_id: call.id,
  });
  report("invitee can accept the call", !acceptError && accepted?.status === "connecting", acceptError?.message);

  const { data: ended, error: endError } = await coach.client.rpc("end_call", {
    p_call_id: call.id,
  });
  report("participant can end the call", !endError && ended?.status === "ended", endError?.message);

  const { data: videoCall, error: videoInitiateError } = await coach.client.rpc(
    "initiate_call",
    {
      p_recipient_id: client.userId,
      p_kind: "video",
      p_client_request_id: crypto.randomUUID(),
    },
  );
  report(
    "assigned coach can initiate a video call",
    !videoInitiateError && videoCall?.kind === "video" && videoCall.status === "ringing",
    videoInitiateError?.message,
  );
  if (videoCall) {
    const { data: videoAccepted, error: videoAcceptError } =
      await client.client.rpc("accept_call", { p_call_id: videoCall.id });
    report(
      "invitee can accept the video call",
      !videoAcceptError && videoAccepted?.status === "connecting",
      videoAcceptError?.message,
    );
    const { data: videoEnded, error: videoEndError } = await coach.client.rpc(
      "end_call",
      { p_call_id: videoCall.id },
    );
    report(
      "participant can end the video call",
      !videoEndError && videoEnded?.status === "ended",
      videoEndError?.message,
    );
  }

  const [friendLowId, friendHighId] = [client.userId, friend.userId].sort();
  const { data: existingFriendship, error: friendshipLookupError } = await admin
    .from("friendships")
    .select("id")
    .eq("user_low_id", friendLowId)
    .eq("user_high_id", friendHighId)
    .maybeSingle();
  if (friendshipLookupError) {
    throw new Error(`Cannot inspect friend call fixture: ${friendshipLookupError.message}`);
  }
  const { error: friendshipError } = await admin.from("friendships").upsert({
    user_low_id: friendLowId,
    user_high_id: friendHighId,
  }, { onConflict: "user_low_id,user_high_id" });
  if (friendshipError) {
    throw new Error(`Cannot create friend call fixture: ${friendshipError.message}`);
  }

  const { data: friendCall, error: friendCallError } = await client.client.rpc(
    "initiate_call",
    {
      p_recipient_id: friend.userId,
      p_kind: "video",
      p_client_request_id: crypto.randomUUID(),
    },
  );
  report(
    "accepted friends can initiate a video call",
    !friendCallError &&
      friendCall?.relationship_kind === "friend" &&
      friendCall.status === "ringing",
    friendCallError?.message,
  );
  if (friendCall) {
    const { data: friendAccepted, error: friendAcceptError } =
      await friend.client.rpc("accept_call", { p_call_id: friendCall.id });
    report(
      "a friend can accept the call",
      !friendAcceptError && friendAccepted?.status === "connecting",
      friendAcceptError?.message,
    );
    await client.client.rpc("end_call", { p_call_id: friendCall.id });
  }

  const { error: removeFriendshipError } = await admin.from("friendships")
    .delete()
    .eq("user_low_id", friendLowId)
    .eq("user_high_id", friendHighId);
  if (removeFriendshipError) {
    throw new Error(`Cannot remove friend call fixture: ${removeFriendshipError.message}`);
  }
  const { error: formerFriendCallError } = await client.client.rpc(
    "initiate_call",
    {
      p_recipient_id: friend.userId,
      p_kind: "audio",
      p_client_request_id: crypto.randomUUID(),
    },
  );
  report("people who are no longer friends cannot call", !!formerFriendCallError);
  if (existingFriendship) {
    const { error: restoreFriendshipError } = await admin.from("friendships").insert({
      id: existingFriendship.id,
      user_low_id: friendLowId,
      user_high_id: friendHighId,
    });
    if (restoreFriendshipError) {
      throw new Error(`Cannot restore friend call fixture: ${restoreFriendshipError.message}`);
    }
  }

  const { data: webhookCall, error: webhookInitiateError } = await coach.client.rpc(
    "initiate_call",
    {
      p_recipient_id: client.userId,
      p_kind: "audio",
      p_client_request_id: crypto.randomUUID(),
    },
  );
  if (webhookInitiateError || !webhookCall) {
    throw new Error(`Cannot create webhook verification call: ${webhookInitiateError?.message}`);
  }
  const { error: webhookAcceptError } = await client.client.rpc("accept_call", {
    p_call_id: webhookCall.id,
  });
  if (webhookAcceptError) {
    throw new Error(`Cannot accept webhook verification call: ${webhookAcceptError.message}`);
  }

  const joinedAt = new Date(Date.now() + 1_000);
  const reconcile = (input: {
    eventId: string;
    eventType: string;
    participantId: string | null;
    participantSid: string | null;
    occurredAt: Date;
  }) => sendLiveKitWebhook({
    ...input,
    roomName: webhookCall.provider_room_name,
  });

  const coachJoined = await reconcile({
    eventId: crypto.randomUUID(),
    eventType: "participant_joined",
    participantId: coach.userId,
    participantSid: "PA_coach_1",
    occurredAt: joinedAt,
  });
  const clientJoinEventId = crypto.randomUUID();
  const clientJoined = await reconcile({
    eventId: clientJoinEventId,
    eventType: "participant_joined",
    participantId: client.userId,
    participantSid: "PA_client_1",
    occurredAt: new Date(joinedAt.getTime() + 1_000),
  });
  const duplicateJoin = await reconcile({
    eventId: clientJoinEventId,
    eventType: "participant_joined",
    participantId: client.userId,
    participantSid: "PA_client_1",
    occurredAt: new Date(joinedAt.getTime() + 1_000),
  });
  const { data: activeWebhookCall } = await admin.from("calls")
    .select("status")
    .eq("id", webhookCall.id)
    .single();
  const { count: duplicateEventCount, error: duplicateEventCountError } =
    await admin.from("call_events")
      .select("id", { count: "exact", head: true })
      .eq("provider_event_id", clientJoinEventId);
  report(
    "verified participant joins atomically activate the call",
    !coachJoined.error &&
      !clientJoined.error &&
      activeWebhookCall?.status === "active",
    coachJoined.error?.message ?? clientJoined.error?.message,
  );
  report(
    "duplicate provider events are idempotent",
    !duplicateJoin.error &&
      !duplicateEventCountError &&
      duplicateEventCount === 1,
    duplicateJoin.error?.message ?? duplicateEventCountError?.message,
  );

  const rejoinedAt = new Date(joinedAt.getTime() + 2_000);
  const coachRejoined = await reconcile({
    eventId: crypto.randomUUID(),
    eventType: "participant_joined",
    participantId: coach.userId,
    participantSid: "PA_coach_2",
    occurredAt: rejoinedAt,
  });
  const staleLeave = await reconcile({
    eventId: crypto.randomUUID(),
    eventType: "participant_left",
    participantId: coach.userId,
    participantSid: "PA_coach_1",
    occurredAt: new Date(rejoinedAt.getTime() + 1_000),
  });
  const { data: afterStaleLeave } = await admin.from("call_participants")
    .select("left_at,provider_participant_sid,reconnect_count")
    .eq("call_id", webhookCall.id)
    .eq("user_id", coach.userId)
    .single();
  report(
    "a stale leave cannot overwrite a newer participant session",
    !coachRejoined.error &&
      !staleLeave.error &&
      afterStaleLeave?.left_at === null &&
      afterStaleLeave.provider_participant_sid === "PA_coach_2" &&
      afterStaleLeave.reconnect_count === 1,
    coachRejoined.error?.message ?? staleLeave.error?.message,
  );

  const currentLeaveAt = new Date(rejoinedAt.getTime() + 2_000);
  const currentLeave = await reconcile({
    eventId: crypto.randomUUID(),
    eventType: "participant_left",
    participantId: coach.userId,
    participantSid: "PA_coach_2",
    occurredAt: currentLeaveAt,
  });
  const { data: callDuringGrace } = await admin.from("calls")
    .select("status")
    .eq("id", webhookCall.id)
    .single();
  report(
    "participant leave keeps the call active during reconnect grace",
    !currentLeave.error && callDuringGrace?.status === "active",
    currentLeave.error?.message,
  );

  const expiry = await admin.rpc("expire_stale_calls", {
    p_now: new Date(currentLeaveAt.getTime() + 21_000).toISOString(),
  });
  const { data: callAfterGrace } = await admin.from("calls")
    .select("status,end_reason")
    .eq("id", webhookCall.id)
    .single();
  report(
    "disconnect grace eventually records a network failure",
    !expiry.error &&
      callAfterGrace?.status === "failed" &&
      callAfterGrace.end_reason === "network_lost",
    expiry.error?.message,
  );

  await client.client.removeChannel(callChannel);
  await Promise.all([
    coach.client.realtime.disconnect(),
    client.client.realtime.disconnect(),
    unrelated.client.realtime.disconnect(),
    admin.realtime.disconnect(),
  ]);

  if (failures > 0) {
    console.error(`\n${failures} call verification check(s) failed.`);
    process.exit(1);
  }
  console.log("\nCall control and RLS verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
