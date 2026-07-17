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
  coach2: { email: "coach2@fish.dev", password: "fish-coach-dev" },
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

type PresenceCommandPayload = {
  snapshot?: {
    status: "online" | "idle" | "away" | "busy" | "offline";
  };
  setting?: {
    preference: "automatic" | "away" | "busy" | "invisible";
    expiresAt: string | null;
  };
  code?: string;
  error?: string;
};

type RealtimeSnapshot = {
  user_id?: string;
  status?: string;
  revision?: number;
};

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 3_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return predicate();
}

async function setPresenceThroughEdge(
  session: Awaited<ReturnType<typeof signIn>>,
  mode: "automatic" | "away" | "busy" | "invisible",
  durationSeconds: 900 | 3_600 | 28_800 | 86_400 | 259_200 | null = null,
) {
  const result = await session.client.functions.invoke<PresenceCommandPayload>(
    "presence-command",
    { body: { mode, durationSeconds } },
  );
  let payload = result.data;
  const context = result.error && "context" in result.error
    ? result.error.context
    : null;
  if (context instanceof Response) {
    payload = await context.json().catch(() => null) as PresenceCommandPayload | null;
  }
  return { payload, error: result.error };
}

async function main() {
  const coach = await signIn(identities.coach);
  const coach2 = await signIn(identities.coach2);
  const client = await signIn(identities.client);
  const communityOnly = await signIn(identities.communityOnly);
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonymous = createClient(supabaseUrl!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const firstSession = crypto.randomUUID();
  const secondSession = crypto.randomUUID();
  const blockedSession = crypto.randomUUID();
  const realtimeChannels: ReturnType<typeof coach.client.channel>[] = [];
  const coachEvents: RealtimeSnapshot[] = [];
  const communityEvents: RealtimeSnapshot[] = [];
  let coachSubjectChangeCount = 0;
  let coach2SubjectChangeCount = 0;
  const [friendLowId, friendHighId] = [client.userId, communityOnly.userId].sort();
  const existingFriendship = await admin.from("friendships")
    .select("user_low_id,user_high_id")
    .eq("user_low_id", friendLowId)
    .eq("user_high_id", friendHighId)
    .maybeSingle();
  if (existingFriendship.error) throw existingFriendship.error;

  async function subscribeToSnapshots(
    viewer: Awaited<ReturnType<typeof signIn>>,
    label: string,
    events: RealtimeSnapshot[],
  ) {
    await viewer.client.realtime.setAuth();
    let subscribed = false;
    let replicationReady = false;
    let replicationError: string | null = null;
    let settle = () => {};
    const channel = viewer.client
      .channel(`verify-presence-${label}-${crypto.randomUUID()}`, {
        config: { broadcast: { replication_ready: true } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presence_snapshots",
          filter: `user_id=in.(${client.userId})`,
        },
        (payload) => events.push(payload.new as RealtimeSnapshot),
      )
      .on("system", {}, (payload) => {
        if (payload.status === "ok") replicationReady = true;
        if (payload.status === "error") replicationError = payload.message;
        settle();
      });
    realtimeChannels.push(channel);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`${label} presence subscription timed out`)),
        5_000,
      );
      settle = () => {
        if (replicationError) {
          clearTimeout(timeout);
          reject(new Error(`${label} presence replication failed: ${replicationError}`));
        } else if (subscribed && replicationReady) {
          clearTimeout(timeout);
          resolve();
        }
      };
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          settle();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          clearTimeout(timeout);
          reject(new Error(`${label} presence subscription ${status.toLowerCase()}`));
        }
      });
    });
  }

  async function subscribeToSubjectChanges(
    viewer: Awaited<ReturnType<typeof signIn>>,
    label: string,
    onChange: () => void,
  ) {
    await viewer.client.realtime.setAuth();
    const channel = viewer.client
      .channel(`presence:user:${viewer.userId}`, { config: { private: true } })
      .on("broadcast", { event: "presence.subjects.changed" }, () => {
        onChange();
      });
    realtimeChannels.push(channel);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`${label} subject subscription timed out`)),
        5_000,
      );
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          clearTimeout(timeout);
          reject(new Error(`${label} subject subscription ${status.toLowerCase()}`));
        }
      });
    });
  }

  async function cleanup() {
    await admin.from("coach_clients")
      .update({ coach_id: coach.userId })
      .eq("client_id", client.userId);
    await admin.from("user_blocks").delete()
      .eq("blocker_id", client.userId)
      .eq("blocked_id", coach.userId);
    await admin.from("presence_sessions").delete().eq("user_id", client.userId);
    await admin.from("presence_snapshots").delete().eq("user_id", client.userId);
    await admin.from("presence_preferences").delete().eq("user_id", client.userId);
    await admin.from("friendships").delete()
      .eq("user_low_id", friendLowId)
      .eq("user_high_id", friendHighId);
  }

  await cleanup();
  try {
    const coachSubjectsBeforeSnapshot = await coach.client.rpc("list_visible_presence");
    const communitySubjectsBeforeSnapshot = await communityOnly.client.rpc(
      "list_visible_presence",
    );
    report(
      "trusted subject discovery includes users without snapshots",
      coachSubjectsBeforeSnapshot.data?.some((row) =>
        row.user_id === client.userId && row.status === "offline" && row.revision === 0
      ) === true,
      coachSubjectsBeforeSnapshot.error?.message,
    );
    report(
      "subject discovery excludes unrelated users without snapshots",
      communitySubjectsBeforeSnapshot.data?.some((row) =>
        row.user_id === client.userId
      ) === false,
      communitySubjectsBeforeSnapshot.error?.message,
    );
    await Promise.all([
      subscribeToSnapshots(coach, "coach", coachEvents),
      subscribeToSnapshots(communityOnly, "community", communityEvents),
      subscribeToSubjectChanges(coach, "coach", () => {
        coachSubjectChangeCount += 1;
      }),
      subscribeToSubjectChanges(coach2, "coach2", () => {
        coach2SubjectChangeCount += 1;
      }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const touch = await client.client.rpc("touch_presence_session", {
      p_session_id: firstSession,
      p_activity: true,
      p_ended: false,
    });
    report("an authenticated tab creates an Online snapshot", touch.data?.status === "online", touch.error?.message);
    const firstRevision = touch.data?.revision;
    const coachReceivedInsert = await waitForCondition(() =>
      coachEvents.some((event) =>
        event.user_id === client.userId && event.revision === firstRevision
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    report(
      "trusted viewers receive first-time snapshot inserts",
      coachReceivedInsert,
    );
    report(
      "untrusted realtime viewers do not receive snapshots",
      communityEvents.every((event) => event.user_id !== client.userId),
    );

    const anonymousCommand = await anonymous.rpc("set_presence_mode", {
      p_mode: "away",
      p_duration_seconds: 900,
    });
    report(
      "anonymous users cannot execute the presence command",
      anonymousCommand.error?.code === "42501",
      anonymousCommand.error?.message,
    );

    const edgeAway = await setPresenceThroughEdge(client, "away", 900);
    report(
      "the browser status command returns one atomic timed result",
      !edgeAway.error &&
        edgeAway.payload?.snapshot?.status === "away" &&
        edgeAway.payload.setting?.preference === "away" &&
        Date.parse(edgeAway.payload.setting.expiresAt ?? "") > Date.now(),
      edgeAway.payload?.error ?? edgeAway.error?.message,
    );
    await admin.from("presence_preferences")
      .update({ expires_at: new Date(Date.now() - 1_000).toISOString() })
      .eq("user_id", client.userId);
    const expiredAway = await client.client.rpc("touch_presence_session", {
      p_session_id: firstSession,
      p_activity: true,
      p_ended: false,
    });
    report(
      "an expired timed status resolves back to Automatic",
      expiredAway.data?.status === "online",
      expiredAway.error?.message,
    );
    const edgeAutomatic = await setPresenceThroughEdge(client, "automatic");
    report(
      "the browser status command restores Automatic mode",
      !edgeAutomatic.error && edgeAutomatic.payload?.snapshot?.status === "online",
      edgeAutomatic.payload?.error ?? edgeAutomatic.error?.message,
    );

    const ownerSessions = await client.client.from("presence_sessions")
      .select("id").eq("user_id", client.userId);
    const coachSessions = await coach.client.from("presence_sessions")
      .select("id").eq("user_id", client.userId);
    report(
      "owners can read their own raw sessions",
      ownerSessions.data?.some((session) => session.id === firstSession) === true,
      ownerSessions.error?.message,
    );
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

    await waitForCondition(() => coachEvents.some((event) =>
      event.user_id === client.userId && event.revision === allEnded.data?.revision
    ));

    const coachChangesBeforeReassignment = coachSubjectChangeCount;
    const coach2ChangesBeforeReassignment = coach2SubjectChangeCount;
    const reassignment = await admin.from("coach_clients")
      .update({ coach_id: coach2.userId })
      .eq("client_id", client.userId);
    if (reassignment.error) throw reassignment.error;
    report(
      "coach reassignment refreshes old and new subject filters",
      await waitForCondition(() =>
        coachSubjectChangeCount > coachChangesBeforeReassignment &&
        coach2SubjectChangeCount > coach2ChangesBeforeReassignment
      ),
    );
    const restoreAssignment = await admin.from("coach_clients")
      .update({ coach_id: coach.userId })
      .eq("client_id", client.userId);
    if (restoreAssignment.error) throw restoreAssignment.error;

    const subjectChangesBeforeBlock = coachSubjectChangeCount;
    const block = await admin.from("user_blocks").insert({
      blocker_id: client.userId,
      blocked_id: coach.userId,
    });
    if (block.error) throw block.error;
    report(
      "relationship changes wake authoritative subject refresh",
      await waitForCondition(() =>
        coachSubjectChangeCount > subjectChangesBeforeBlock
      ),
    );
    const blockedVisible = await coach.client.rpc("list_visible_presence");
    report(
      "blocking removes presence visibility even for an assigned pair",
      blockedVisible.data?.some((row) => row.user_id === client.userId) === false,
      blockedVisible.error?.message,
    );
    const blockedTouch = await client.client.rpc("touch_presence_session", {
      p_session_id: blockedSession,
      p_activity: true,
      p_ended: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 750));
    report(
      "relationship removal immediately stops realtime snapshots",
      blockedTouch.error === null && coachEvents.every((event) =>
        event.user_id !== client.userId ||
        event.revision !== blockedTouch.data?.revision
      ),
      blockedTouch.error?.message,
    );
  } finally {
    await Promise.all(realtimeChannels.map((channel) => channel.unsubscribe()));
    await cleanup();
    if (existingFriendship.data) {
      await admin.from("friendships").upsert(existingFriendship.data, {
        onConflict: "user_low_id,user_high_id",
      });
    }
    await Promise.all([
      coach.client.auth.signOut(),
      coach2.client.auth.signOut(),
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
