// Live presence/RLS verification against local Supabase. Seeds deterministic
// users, exercises authenticated RPCs, and restores the touched presence rows.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error("Missing local Supabase URL, publishable key, or service-role key.");
  process.exit(1);
}

const identities = {
  coach: { email: "coach@fish.dev", password: "fish-coach-dev" },
  client: { email: "client1@fish.dev", password: "fish-client-dev" },
  communityOnly: { email: "member1@fish.dev", password: "fish-client-dev" },
};

let failures = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function signIn(identity: { email: string; password: string }) {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword(identity);
  if (error || !data.user) throw new Error(`Could not sign in ${identity.email}`);
  return { client, userId: data.user.id };
}

async function main() {
  const coach = await signIn(identities.coach);
  const client = await signIn(identities.client);
  const communityOnly = await signIn(identities.communityOnly);
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const firstSession = crypto.randomUUID();
  const secondSession = crypto.randomUUID();

  async function cleanup() {
    await admin.from("user_blocks").delete()
      .eq("blocker_id", client.userId)
      .eq("blocked_id", coach.userId);
    await admin.from("presence_sessions").delete().eq("user_id", client.userId);
    await admin.from("presence_snapshots").delete().eq("user_id", client.userId);
    await admin.from("presence_preferences").delete().eq("user_id", client.userId);
  }

  await cleanup();
  try {
    const touch = await client.client.rpc("touch_presence_session", {
      p_session_id: firstSession,
      p_activity: true,
      p_ended: false,
    });
    report("an authenticated tab creates an Online snapshot", touch.data?.status === "online", touch.error?.message);

    const ownerSessions = await client.client.from("presence_sessions")
      .select("id").eq("user_id", client.userId);
    const coachSessions = await coach.client.from("presence_sessions")
      .select("id").eq("user_id", client.userId);
    report("owners can read their own raw sessions", ownerSessions.data?.length === 1, ownerSessions.error?.message);
    report("trusted viewers cannot read raw sessions", coachSessions.data?.length === 0, coachSessions.error?.message);

    const coachVisible = await coach.client.rpc("list_visible_presence");
    const communityVisible = await communityOnly.client.rpc("list_visible_presence");
    report(
      "assigned coaches can hydrate sanitized client presence",
      coachVisible.data?.some((row) => row.user_id === client.userId && row.status === "online") === true,
      coachVisible.error?.message,
    );
    report(
      "community-only membership does not grant presence access",
      communityVisible.data?.some((row) => row.user_id === client.userId) === false,
      communityVisible.error?.message,
    );

    const invisible = await client.client.rpc("set_presence_mode", { p_mode: "invisible" });
    const invisibleForCoach = await coach.client.rpc("list_visible_presence");
    const externalInvisible = invisibleForCoach.data?.find((row) => row.user_id === client.userId);
    report(
      "Invisible is stored and exposed as plain Offline",
      invisible.data?.status === "offline" &&
        invisible.data?.last_heartbeat_at === null &&
        invisible.data?.last_seen_at === null &&
        externalInvisible?.status === "offline" &&
        externalInvisible.last_heartbeat_at === null &&
        externalInvisible.last_seen_at === null,
      invisible.error?.message,
    );

    const away = await client.client.rpc("set_presence_mode", { p_mode: "away" });
    const busy = await client.client.rpc("set_presence_mode", { p_mode: "busy" });
    report("Away and Busy override a fresh session", away.data?.status === "away" && busy.data?.status === "busy");

    await client.client.rpc("set_presence_mode", { p_mode: "automatic" });
    await client.client.rpc("touch_presence_session", {
      p_session_id: secondSession,
      p_activity: true,
      p_ended: false,
    });
    const oneEnded = await client.client.rpc("touch_presence_session", {
      p_session_id: firstSession,
      p_activity: false,
      p_ended: true,
    });
    const allEnded = await client.client.rpc("touch_presence_session", {
      p_session_id: secondSession,
      p_activity: false,
      p_ended: true,
    });
    report("one live device keeps a multi-device account Online", oneEnded.data?.status === "online");
    report("the final ended device resolves Offline", allEnded.data?.status === "offline");

    const block = await admin.from("user_blocks").insert({
      blocker_id: client.userId,
      blocked_id: coach.userId,
    });
    if (block.error) throw block.error;
    const blockedVisible = await coach.client.rpc("list_visible_presence");
    report(
      "blocking removes presence visibility even for an assigned pair",
      blockedVisible.data?.some((row) => row.user_id === client.userId) === false,
      blockedVisible.error?.message,
    );
  } finally {
    await cleanup();
    await Promise.all([
      coach.client.auth.signOut(),
      client.client.auth.signOut(),
      communityOnly.client.auth.signOut(),
    ]);
  }

  if (failures > 0) process.exit(1);
  console.log("Presence verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
