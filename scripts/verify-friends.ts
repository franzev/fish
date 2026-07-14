// Live friendship verification through authenticated sessions against local
// Supabase. Run `supabase start`, seed with `pnpm seed`, then `pnpm
// verify:friends`. Covers two clients plus a coach: request lifecycle,
// idempotency, crossed requests, RLS privacy, blocking, decline cooldown,
// notifications, and private realtime topic isolation.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error(
    "Missing Supabase URL, publishable key, or local service-role key. Run `supabase start` and configure apps/web/.env.local.",
  );
  process.exit(1);
}

const users = {
  coach: { email: "coach@fish.dev", password: "fish-coach-dev" },
  clientA: { email: "client1@fish.dev", password: "fish-client-dev" },
  clientB: { email: "client2@fish.dev", password: "fish-client-dev" },
  clientC: { email: "client3@fish.dev", password: "fish-client-dev" },
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

type Session = Awaited<ReturnType<typeof signIn>>;

type EdgeCommandPayload = {
  request?: { id: string; status: string };
  done?: boolean;
  updated?: number;
  code?: string;
  error?: string;
};

async function invokeFriendCommand(
  session: Session,
  body: Record<string, unknown>,
) {
  const result = await session.client.functions.invoke<EdgeCommandPayload>(
    "friend-command",
    { body },
  );
  let payload = result.data;
  const context = result.error && "context" in result.error
    ? result.error.context
    : null;
  if (context instanceof Response) {
    payload = await context.json().catch(() => null) as EdgeCommandPayload | null;
  }
  return { payload, error: result.error };
}

async function main() {
  const coach = await signIn(users.coach.email, users.coach.password);
  const a = await signIn(users.clientA.email, users.clientA.password);
  const b = await signIn(users.clientB.email, users.clientB.password);
  const c = await signIn(users.clientC.email, users.clientC.password);
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: originalGate, error: originalGateError } = await admin
    .from("feature_flags")
    .select("enabled")
    .eq("key", "friends")
    .single();
  if (originalGateError) throw originalGateError;

  const involved = [a.userId, b.userId, c.userId];

  async function cleanup() {
    await admin.from("friendships").delete()
      .or(`user_low_id.in.(${involved.join(",")}),user_high_id.in.(${involved.join(",")})`);
    await admin.from("user_notifications").delete()
      .or(`recipient_id.in.(${involved.join(",")}),actor_id.in.(${involved.join(",")})`);
    await admin.from("user_blocks").delete()
      .or(`blocker_id.in.(${involved.join(",")}),blocked_id.in.(${involved.join(",")})`);
    await admin.from("friend_requests").delete()
      .or(`sender_id.in.(${involved.join(",")}),recipient_id.in.(${involved.join(",")})`);
  }

  await cleanup();

  const disableGate = await admin
    .from("feature_flags")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("key", "friends");
  if (disableGate.error) throw disableGate.error;
  const gatedSearch = await a.client.rpc("search_friend_candidate", {
    p_username: "nobody_here",
  });
  report(
    "the authoritative database rollout gate fails closed",
    !!gatedSearch.error && gatedSearch.error.message.includes("friends not available"),
    gatedSearch.error?.message,
  );
  const enableGate = await admin
    .from("feature_flags")
    .update({ enabled: true, updated_at: new Date().toISOString() })
    .eq("key", "friends");
  if (enableGate.error) throw enableGate.error;

  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, username")
    .in("id", [a.userId, b.userId, c.userId, coach.userId]);
  const usernameOf = new Map(
    (profileRows ?? []).map((row) => [row.id, row.username as string]),
  );
  const usernameA = usernameOf.get(a.userId)!;
  const usernameB = usernameOf.get(b.userId)!;
  const usernameCoach = usernameOf.get(coach.userId)!;

  // --- pagination beyond the old 100-row cap -----------------------------
  const { data: extraProfiles, error: extraProfilesError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client")
    .not("id", "in", `(${involved.join(",")})`)
    .limit(105);
  if (extraProfilesError) throw extraProfilesError;
  const syntheticSenders = extraProfiles ?? [];
  if (syntheticSenders.length < 105) {
    throw new Error("Need at least 105 extra client profiles for pagination verification.");
  }
  const syntheticRows = syntheticSenders.map((profile, index) => ({
    sender_id: profile.id,
    recipient_id: a.userId,
    client_request_id: `verify-pagination-${index}-${crypto.randomUUID()}`,
    created_at: new Date(Date.now() - index * 1_000).toISOString(),
  }));
  const syntheticInsert = await admin.from("friend_requests").insert(syntheticRows);
  if (syntheticInsert.error) throw syntheticInsert.error;
  const { data: requestCount } = await a.client.rpc(
    "count_incoming_friend_requests",
  );
  const { data: firstRequestPage } = await a.client.rpc(
    "list_incoming_friend_requests",
    { p_limit: 50 },
  );
  const firstPageLast = firstRequestPage?.at(-1);
  const { data: secondRequestPage } = await a.client.rpc(
    "list_incoming_friend_requests",
    {
      p_limit: 50,
      p_cursor_created_at: firstPageLast?.created_at,
      p_cursor_id: firstPageLast?.request_id,
    },
  );
  const secondPageLast = secondRequestPage?.at(-1);
  const { data: thirdRequestPage } = await a.client.rpc(
    "list_incoming_friend_requests",
    {
      p_limit: 50,
      p_cursor_created_at: secondPageLast?.created_at,
      p_cursor_id: secondPageLast?.request_id,
    },
  );
  const oldestRequest = thirdRequestPage?.at(-1);
  const { data: oldestRequestDetail } = await a.client.rpc(
    "get_incoming_friend_request",
    { p_request_id: oldestRequest?.request_id },
  );
  report(
    "incoming requests paginate past 100 and remain directly reviewable",
    requestCount === 105 &&
      firstRequestPage?.length === 50 &&
      secondRequestPage?.length === 50 &&
      thirdRequestPage?.length === 5 &&
      oldestRequestDetail?.[0]?.request_id === oldestRequest?.request_id,
    JSON.stringify({
      requestCount,
      pages: [
        firstRequestPage?.length,
        secondRequestPage?.length,
        thirdRequestPage?.length,
      ],
    }),
  );
  const syntheticCleanup = await admin
    .from("friend_requests")
    .delete()
    .eq("recipient_id", a.userId)
    .like("client_request_id", "verify-pagination-%");
  if (syntheticCleanup.error) throw syntheticCleanup.error;

  // --- private realtime topics -------------------------------------------
  await a.client.realtime.setAuth();
  await b.client.realtime.setAuth();

  const bEvents: Array<{ requestId?: string; reason?: string }> = [];
  let resolveFirstEvent: (value: boolean) => void;
  const firstEventReceived = new Promise<boolean>((resolve) => {
    resolveFirstEvent = resolve;
  });
  let resolveOwnTopic: (ready: boolean) => void;
  const ownTopicReady = new Promise<boolean>((resolve) => {
    resolveOwnTopic = resolve;
  });
  const bChannel = b.client
    .channel(`friends:user:${b.userId}`, { config: { private: true } })
    .on("broadcast", { event: "friends.changed" }, ({ payload }) => {
      bEvents.push(payload as { requestId?: string; reason?: string });
      resolveFirstEvent(true);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") resolveOwnTopic(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolveOwnTopic(false);
    });
  report(
    "client can subscribe to their own private friends topic",
    await Promise.race([
      ownTopicReady,
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]),
  );

  const aEvents: Array<{ requestId?: string; reason?: string }> = [];
  let resolveATopic: (ready: boolean) => void;
  const aTopicReady = new Promise<boolean>((resolve) => {
    resolveATopic = resolve;
  });
  const aChannel = a.client
    .channel(`friends:user:${a.userId}`, { config: { private: true } })
    .on("broadcast", { event: "friends.changed" }, ({ payload }) => {
      aEvents.push(payload as { requestId?: string; reason?: string });
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") resolveATopic(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolveATopic(false);
    });
  await Promise.race([
    aTopicReady,
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);

  let resolveForeignTopic: (subscribed: boolean) => void;
  const foreignTopicSubscribed = new Promise<boolean>((resolve) => {
    resolveForeignTopic = resolve;
  });
  const foreignChannel = a.client
    .channel(`friends:user:${b.userId}`, { config: { private: true } })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") resolveForeignTopic(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolveForeignTopic(false);
    });
  report(
    "client cannot subscribe to another user's friends topic",
    !(await Promise.race([
      foreignTopicSubscribed,
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
    ])),
  );

  // --- search privacy ------------------------------------------------------
  const { data: candidate } = await a.client.rpc("search_friend_candidate", {
    p_username: `@${usernameB.toUpperCase()}`,
  });
  report(
    "search finds a client by username, case- and @-insensitive",
    candidate?.status === "none" && candidate?.profile?.username === usernameB,
    JSON.stringify(candidate),
  );
  report(
    "search result exposes only safe profile fields",
    candidate?.profile &&
      Object.keys(candidate.profile).sort().join(",") ===
        "display_name,id,username",
    JSON.stringify(candidate?.profile),
  );
  const { data: selfSearch } = await a.client.rpc("search_friend_candidate", {
    p_username: usernameA,
  });
  const { data: coachSearch } = await a.client.rpc("search_friend_candidate", {
    p_username: usernameCoach,
  });
  const { data: ghostSearch } = await a.client.rpc("search_friend_candidate", {
    p_username: "no_such_person",
  });
  report(
    "self, coach, and unknown lookups collapse into the same unavailable answer",
    selfSearch?.status === "unavailable" &&
      coachSearch?.status === "unavailable" &&
      ghostSearch?.status === "unavailable",
  );
  const { error: coachSearchError } = await coach.client.rpc(
    "search_friend_candidate",
    { p_username: usernameA },
  );
  report("coach cannot use friend search", !!coachSearchError);

  // --- send + idempotency --------------------------------------------------
  const requestKey = crypto.randomUUID();
  const [first, second] = await Promise.all([
    a.client.rpc("send_friend_request", {
      p_target_id: b.userId,
      p_client_request_id: requestKey,
    }),
    a.client.rpc("send_friend_request", {
      p_target_id: b.userId,
      p_client_request_id: requestKey,
    }),
  ]);
  const requestId: string | undefined = first.data?.id ?? second.data?.id;
  report(
    "parallel duplicate sends collapse into one request",
    !!requestId &&
      (first.data?.id ?? second.data?.id) === requestId &&
      (first.error === null || second.error === null) &&
      (first.data?.id === undefined || first.data.id === requestId) &&
      (second.data?.id === undefined || second.data.id === requestId),
    first.error?.message ?? second.error?.message,
  );
  const { count: pendingCount } = await admin
    .from("friend_requests")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", a.userId)
    .eq("recipient_id", b.userId)
    .eq("status", "pending");
  report("exactly one pending request exists for the pair", pendingCount === 1);

  const { error: duplicateError } = await a.client.rpc("send_friend_request", {
    p_target_id: b.userId,
    p_client_request_id: crypto.randomUUID(),
  });
  report(
    "a second request with a new key reports the pending state",
    !!duplicateError && duplicateError.message.includes("request pending"),
    duplicateError?.message,
  );

  const { error: crossedError } = await b.client.rpc("send_friend_request", {
    p_target_id: a.userId,
    p_client_request_id: crypto.randomUUID(),
  });
  report(
    "a crossed request is guided to review, never auto-accepted",
    !!crossedError && crossedError.message.includes("incoming request exists"),
    crossedError?.message,
  );

  const { data: outgoingSearch } = await a.client.rpc("search_friend_candidate", {
    p_username: usernameB,
  });
  const { data: incomingSearch } = await b.client.rpc("search_friend_candidate", {
    p_username: usernameA,
  });
  report(
    "search reflects pending state from both sides",
    outgoingSearch?.status === "outgoing_pending" &&
      incomingSearch?.status === "incoming_pending" &&
      incomingSearch?.request_id === requestId,
  );

  report(
    "recipient's private topic received a request wake-up hint",
    await Promise.race([
      firstEventReceived,
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 10_000)),
    ]),
  );

  // --- privacy of the pending request --------------------------------------
  const { data: incomingForB } = await b.client.rpc("list_incoming_friend_requests");
  report(
    "recipient lists the incoming request with safe sender fields",
    Array.isArray(incomingForB) &&
      incomingForB.length === 1 &&
      incomingForB[0].request_id === requestId &&
      incomingForB[0].username === usernameA,
    JSON.stringify(incomingForB),
  );
  const { data: incomingForC } = await c.client.rpc("list_incoming_friend_requests");
  const { data: rowsForC } = await c.client
    .from("friend_requests")
    .select("id")
    .eq("id", requestId!);
  report(
    "an unrelated client sees nothing about the request",
    incomingForC?.length === 0 && rowsForC?.length === 0,
  );
  const { error: strangerRespondError } = await c.client.rpc(
    "respond_friend_request",
    { p_request_id: requestId, p_response: "accept" },
  );
  report("an unrelated client cannot respond", !!strangerRespondError);
  const { error: senderAcceptError } = await a.client.rpc(
    "respond_friend_request",
    { p_request_id: requestId, p_response: "accept" },
  );
  report("the sender cannot accept their own request", !!senderAcceptError);

  // --- accept ---------------------------------------------------------------
  const { data: accepted, error: acceptError } = await b.client.rpc(
    "respond_friend_request",
    { p_request_id: requestId, p_response: "accept" },
  );
  report(
    "recipient accepts and the request resolves",
    !acceptError && accepted?.status === "accepted",
    acceptError?.message,
  );
  const { data: acceptedAgain, error: acceptRetryError } = await b.client.rpc(
    "respond_friend_request",
    { p_request_id: requestId, p_response: "accept" },
  );
  report(
    "accept retry is idempotent",
    !acceptRetryError && acceptedAgain?.status === "accepted",
    acceptRetryError?.message,
  );
  const { error: lateDeclineError } = await b.client.rpc(
    "respond_friend_request",
    { p_request_id: requestId, p_response: "decline" },
  );
  report(
    "declining an accepted request reports it as resolved",
    !!lateDeclineError && lateDeclineError.message.includes("already resolved"),
    lateDeclineError?.message,
  );

  const { data: friendsOfA } = await a.client.rpc("list_friends", {});
  const { data: friendsOfB } = await b.client.rpc("list_friends", {});
  report(
    "both clients now list each other as friends",
    friendsOfA?.length === 1 &&
      friendsOfA?.[0]?.friend_id === b.userId &&
      friendsOfB?.length === 1 &&
      friendsOfB?.[0]?.friend_id === a.userId,
  );

  const { data: friendProfileRows, error: friendProfileError } = await a.client
    .from("profiles")
    .select("id, email")
    .eq("id", b.userId);
  report(
    "friendship does not expose the other client's private profile row",
    !friendProfileError && friendProfileRows?.length === 0,
    friendProfileError?.message ?? JSON.stringify(friendProfileRows),
  );

  const { data: directPreviews, error: directPreviewsError } = await a.client.rpc(
    "list_direct_conversation_previews",
  );
  const friendPreview = directPreviews?.find(
    (preview) => preview.participant_id === b.userId,
  );
  report(
    "accepted friends receive a display-safe direct-conversation preview",
    !directPreviewsError &&
      !!friendPreview &&
      Object.keys(friendPreview).every((key) => [
        "conversation_id",
        "participant_id",
        "participant_role",
        "participant_display_name",
        "latest_message_sender_id",
        "latest_message_text",
        "latest_message_created_at",
        "unread_count",
      ].includes(key)),
    directPreviewsError?.message ?? JSON.stringify(friendPreview),
  );
  const friendConversationId = friendPreview?.conversation_id;
  const { data: attentionWhileFriends } = await a.client.rpc(
    "list_navigation_attention",
  );
  report(
    "the active friend conversation appears in navigation attention",
    !!friendConversationId && attentionWhileFriends?.some(
      (item) => item.surface === "direct" &&
        item.conversation_id === friendConversationId,
    ),
  );

  const { error: reAddError } = await a.client.rpc("send_friend_request", {
    p_target_id: b.userId,
    p_client_request_id: crypto.randomUUID(),
  });
  report(
    "sending to an existing friend reports already friends",
    !!reAddError && reAddError.message.includes("already friends"),
    reAddError?.message,
  );

  // --- durable notifications -------------------------------------------------
  const { data: notificationsForA } = await a.client.rpc(
    "list_friend_notifications",
    {},
  );
  const acceptedNote = notificationsForA?.find(
    (note: { kind: string; entity_id: string }) =>
      note.kind === "friend_request_accepted" && note.entity_id === requestId,
  );
  report(
    "sender received a durable accepted notification with hydrated actor",
    !!acceptedNote && acceptedNote.actor_username === usernameB,
    JSON.stringify(notificationsForA),
  );
  const { data: notificationsForB } = await b.client.rpc(
    "list_friend_notifications",
    {},
  );
  report(
    "the resolved request's received notification is gone",
    !notificationsForB?.some(
      (note: { kind: string }) => note.kind === "friend_request_received",
    ),
  );
  const { data: markedCount } = await a.client.rpc(
    "mark_friend_notifications_read",
    { p_notification_ids: [acceptedNote?.id] },
  );
  const { data: markedAgain } = await a.client.rpc(
    "mark_friend_notifications_read",
    { p_notification_ids: [acceptedNote?.id] },
  );
  report(
    "marking notifications read is scoped and idempotent",
    markedCount === 1 && markedAgain === 0,
  );

  // --- remove -----------------------------------------------------------------
  const { data: removed } = await a.client.rpc("remove_friend", {
    p_target_id: b.userId,
  });
  const { data: removedAgain } = await a.client.rpc("remove_friend", {
    p_target_id: b.userId,
  });
  const { data: friendsAfterRemove } = await b.client.rpc("list_friends", {});
  const { data: previewsAfterRemove } = await a.client.rpc(
    "list_direct_conversation_previews",
  );
  const { data: attentionAfterRemove } = await a.client.rpc(
    "list_navigation_attention",
  );
  report(
    "removing a friend works once and is quiet afterwards",
    removed === true && removedAgain === false && friendsAfterRemove?.length === 0,
  );
  report(
    "ended relationships leave no stale direct preview or attention item",
    !previewsAfterRemove?.some(
      (preview) => preview.conversation_id === friendConversationId,
    ) && !attentionAfterRemove?.some(
      (item) => item.surface === "direct" &&
        item.conversation_id === friendConversationId,
    ),
  );

  // --- block wins ---------------------------------------------------------------
  const { data: reRequest, error: reRequestError } = await a.client.rpc(
    "send_friend_request",
    { p_target_id: b.userId, p_client_request_id: crypto.randomUUID() },
  );
  report(
    "after removal the pair can request again",
    !reRequestError && reRequest?.status === "pending",
    reRequestError?.message,
  );
  const { error: blockError } = await b.client.rpc("block_user", {
    p_target_id: a.userId,
  });
  report("recipient can block the sender", !blockError, blockError?.message);

  const { data: blockResolvedRow } = await admin
    .from("friend_requests")
    .select("status")
    .eq("id", reRequest?.id)
    .single();
  report(
    "blocking resolves the blocked sender's request as a hidden decline",
    blockResolvedRow?.status === "declined",
  );
  const { data: blockedSenderView } = await a.client
    .from("friend_requests")
    .select("id")
    .eq("id", reRequest?.id);
  report(
    "the block never surfaces as a state change on the blocked side",
    blockedSenderView?.length === 0,
  );
  const { data: blockedSearch } = await a.client.rpc("search_friend_candidate", {
    p_username: usernameB,
  });
  const { error: blockedSendError } = await a.client.rpc("send_friend_request", {
    p_target_id: b.userId,
    p_client_request_id: crypto.randomUUID(),
  });
  report(
    "the blocked person sees only unavailable and cannot send",
    blockedSearch?.status === "unavailable" &&
      !!blockedSendError &&
      blockedSendError.message.includes("person unavailable"),
    blockedSendError?.message,
  );
  const { data: blockerNotes } = await b.client.rpc("list_friend_notifications", {});
  const { data: blockedNotes } = await a.client.rpc("list_friend_notifications", {});
  report(
    "blocking clears notifications on both sides without telling anyone",
    blockerNotes?.length === 0 && blockedNotes?.length === 0,
  );
  const { data: blocksSeenByA } = await a.client
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocker_id", b.userId);
  report(
    "only the blocker can read their block rows",
    blocksSeenByA?.length === 0,
  );

  // --- unblock does not restore anything -----------------------------------------
  const { data: unblocked } = await b.client.rpc("unblock_user", {
    p_target_id: a.userId,
  });
  const { data: friendsAfterUnblock } = await b.client.rpc("list_friends", {});
  const { data: unblockedSearchByB } = await b.client.rpc(
    "search_friend_candidate",
    { p_username: usernameA },
  );
  const { data: unblockedSearchByA } = await a.client.rpc(
    "search_friend_candidate",
    { p_username: usernameB },
  );
  report(
    "unblocking restores discovery for the blocker but never the friendship",
    unblocked === true &&
      friendsAfterUnblock?.length === 0 &&
      unblockedSearchByB?.status === "none",
    JSON.stringify(unblockedSearchByB),
  );
  report(
    "the freshly unblocked person still sits in the quiet cooldown",
    unblockedSearchByA?.status === "unavailable",
    JSON.stringify(unblockedSearchByA),
  );

  // --- decline + cooldown (fresh pair so block history stays out of it) -------------
  const { data: thirdRequest } = await c.client.rpc("send_friend_request", {
    p_target_id: a.userId,
    p_client_request_id: crypto.randomUUID(),
  });
  const { data: declined, error: declineError } = await a.client.rpc(
    "respond_friend_request",
    { p_request_id: thirdRequest?.id, p_response: "decline" },
  );
  report(
    "recipient can decline quietly",
    !declineError && declined?.status === "declined",
    declineError?.message,
  );
  const { data: declinedSeenBySender } = await c.client
    .from("friend_requests")
    .select("id")
    .eq("id", thirdRequest?.id);
  report(
    "the declined request disappears from the sender's view",
    declinedSeenBySender?.length === 0,
  );
  const { data: cooldownSearch } = await c.client.rpc("search_friend_candidate", {
    p_username: usernameA,
  });
  const { error: cooldownSendError } = await c.client.rpc("send_friend_request", {
    p_target_id: a.userId,
    p_client_request_id: crypto.randomUUID(),
  });
  const { data: declinerSearch } = await a.client.rpc("search_friend_candidate", {
    p_username: usernameOf.get(c.userId) ?? "",
  });
  report(
    "a declined sender hits the quiet cooldown while the decliner stays free",
    cooldownSearch?.status === "unavailable" &&
      !!cooldownSendError &&
      cooldownSendError.message.includes("person unavailable") &&
      declinerSearch?.status === "none",
    cooldownSendError?.message,
  );

  // --- cancel ------------------------------------------------------------------------
  const { data: bRequest } = await b.client.rpc("send_friend_request", {
    p_target_id: a.userId,
    p_client_request_id: crypto.randomUUID(),
  });
  const { data: cancelled, error: cancelError } = await b.client.rpc(
    "cancel_friend_request",
    { p_request_id: bRequest?.id },
  );
  const { data: cancelledTwice, error: cancelRetryError } = await b.client.rpc(
    "cancel_friend_request",
    { p_request_id: bRequest?.id },
  );
  report(
    "sender can cancel and cancel retries stay idempotent",
    !cancelError && cancelled?.status === "cancelled" &&
      !cancelRetryError && cancelledTwice?.status === "cancelled",
    cancelError?.message ?? cancelRetryError?.message,
  );
  const { error: respondCancelledError } = await a.client.rpc(
    "respond_friend_request",
    { p_request_id: bRequest?.id, p_response: "accept" },
  );
  report(
    "accepting a cancelled request reports it as resolved",
    !!respondCancelledError &&
      respondCancelledError.message.includes("already resolved"),
    respondCancelledError?.message,
  );

  // --- coach exclusion -----------------------------------------------------------------
  const { error: coachSendError } = await coach.client.rpc("send_friend_request", {
    p_target_id: a.userId,
    p_client_request_id: crypto.randomUUID(),
  });
  const { error: sendToCoachError } = await a.client.rpc("send_friend_request", {
    p_target_id: coach.userId,
    p_client_request_id: crypto.randomUUID(),
  });
  report(
    "coaches can neither send nor receive friend requests",
    !!coachSendError && !!sendToCoachError,
    coachSendError?.message ?? sendToCoachError?.message,
  );

  // --- Edge Function command path used by the browser --------------------
  const edgeRequestKey = crypto.randomUUID();
  const edgeSend = await invokeFriendCommand(c, {
    action: "send-request",
    targetId: b.userId,
    clientRequestId: edgeRequestKey,
  });
  const edgeRequestId = edgeSend.payload?.request?.id;
  report(
    "friend-command sends through the authenticated Edge Function",
    !edgeSend.error &&
      typeof edgeRequestId === "string" &&
      edgeSend.payload?.request?.status === "pending",
    edgeSend.payload?.error ?? edgeSend.error?.message,
  );
  const edgeDuplicate = await invokeFriendCommand(c, {
    action: "send-request",
    targetId: b.userId,
    clientRequestId: crypto.randomUUID(),
  });
  report(
    "friend-command maps database conflicts to calm stable codes",
    !!edgeDuplicate.error && edgeDuplicate.payload?.code === "request_pending",
    JSON.stringify(edgeDuplicate.payload),
  );
  const edgeDecline = await invokeFriendCommand(b, {
    action: "respond-request",
    requestId: edgeRequestId,
    response: "decline",
  });
  report(
    "friend-command completes the response lifecycle",
    !edgeDecline.error && edgeDecline.payload?.request?.status === "declined",
    edgeDecline.payload?.error ?? edgeDecline.error?.message,
  );
  const edgeInvalid = await invokeFriendCommand(c, {
    action: "send-request",
  });
  report(
    "friend-command rejects malformed browser commands",
    !!edgeInvalid.error && edgeInvalid.payload?.code === "invalid_request",
    JSON.stringify(edgeInvalid.payload),
  );

  // --- realtime isolation recap ---------------------------------------------------------
  report(
    "every broadcast B received carried only ids and reasons",
    bEvents.length > 0 &&
      bEvents.every(
        (event) =>
          typeof event.reason === "string" &&
          !("email" in event) &&
          !("display_name" in event),
      ),
    JSON.stringify(bEvents.slice(0, 3)),
  );
  report(
    "the blocked sender's topic never learned their request was resolved",
    aEvents
      .filter((event) => event.requestId === reRequest?.id)
      .every((event) => event.reason === "request_created"),
    JSON.stringify(aEvents.filter((event) => event.requestId === reRequest?.id)),
  );

  await cleanup();
  const restoreGate = await admin
    .from("feature_flags")
    .update({
      enabled: originalGate.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("key", "friends");
  if (restoreGate.error) throw restoreGate.error;
  await b.client.removeChannel(bChannel);
  await a.client.removeChannel(aChannel);
  await a.client.removeChannel(foreignChannel);
  await Promise.all(
    [coach, a, b, c].map((session: Session) => session.client.realtime.disconnect()),
  );
  await admin.realtime.disconnect();

  if (failures > 0) {
    console.error(`\n${failures} friends verification check(s) failed.`);
    process.exit(1);
  }
  console.log("\nFriendship control and RLS verification passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
