// Live call-control verification through authenticated PostgREST sessions.
// Media is deliberately out of scope here; this proves lifecycle RPCs and RLS.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Run `supabase start` and configure apps/web/.env.local.",
  );
  process.exit(1);
}

const users = {
  coach: { email: "coach@fish.dev", password: "fish-coach-dev" },
  client: { email: "client1@fish.dev", password: "fish-client-dev" },
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

async function main() {
  const coach = await signIn(users.coach.email, users.coach.password);
  const client = await signIn(users.client.email, users.client.password);
  const unrelated = await signIn(
    users.unrelatedCoach.email,
    users.unrelatedCoach.password,
  );

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

  const { data: call, error: initiateError } = await coach.client.rpc("initiate_call", {
    p_recipient_id: client.userId,
    p_kind: "audio",
    p_client_request_id: crypto.randomUUID(),
  });
  report("assigned coach can initiate an audio call", !initiateError && call?.status === "ringing", initiateError?.message);
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

  const { data: leakedCall, error: unrelatedReadError } = await unrelated.client
    .from("calls")
    .select("id")
    .eq("id", call.id);
  report(
    "unrelated user cannot read the call",
    !unrelatedReadError && leakedCall?.length === 0,
    unrelatedReadError?.message,
  );

  const { error: unauthorizedAcceptError } = await unrelated.client.rpc("accept_call", {
    p_call_id: call.id,
  });
  report("unrelated user cannot accept the call", !!unauthorizedAcceptError);

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
  await client.client.removeChannel(callChannel);

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
