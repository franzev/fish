// End-to-end notification verification through real authenticated sessions.
// Run after `pnpm seed`. The script uses local-only demo accounts and cleans
// the projection it creates.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error("Missing local Supabase settings. Start Supabase and configure apps/web/.env.local.");
  process.exit(1);
}

const credentials = {
  coach: ["coach@fish.dev", "fish-coach-dev"],
  clientA: ["client1@fish.dev", "fish-client-dev"],
  clientB: ["client2@fish.dev", "fish-client-dev"],
  member: ["member1@fish.dev", "fish-client-dev"],
} as const;

let failures = 0;
function report(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${String(detail)})` : ""}`);
  if (!ok) failures += 1;
}

async function signIn([email, password]: readonly [string, string]) {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Could not sign in ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

async function list(client: SupabaseClient, filter = "all", limit = 50, cursor?: {
  category_rank: number;
  last_event_at: string;
  id: string;
}) {
  const { data, error } = await client.rpc("list_notification_items", {
    p_filter: filter,
    p_limit: limit,
    ...(cursor ? {
      p_cursor_category_rank: cursor.category_rank,
      p_cursor_last_event_at: cursor.last_event_at,
      p_cursor_id: cursor.id,
    } : {}),
  });
  if (error) throw error;
  return data as Array<Record<string, unknown>>;
}

async function main() {
  const coach = await signIn(credentials.coach);
  const a = await signIn(credentials.clientA);
  const b = await signIn(credentials.clientB);
  const member = await signIn(credentials.member);
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const testPrefix = "notification-verify-";
  const pair = [a.userId, b.userId];
  async function clearProjection() {
    const result = await admin.from("notification_items").delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (result.error) throw result.error;
  }
  async function cleanupDomain() {
    await admin.from("friendships").delete()
      .or(`user_low_id.in.(${pair.join(",")}),user_high_id.in.(${pair.join(",")})`);
    await admin.from("user_blocks").delete()
      .or(`blocker_id.in.(${pair.join(",")}),blocked_id.in.(${pair.join(",")})`);
    await admin.from("friend_requests").delete()
      .or(`sender_id.in.(${pair.join(",")}),recipient_id.in.(${pair.join(",")})`)
      .like("client_request_id", `${testPrefix}%`);
    await admin.from("system_announcements").delete().like("title", "Notification verify %");
    await admin.from("moderation_actions").delete().like("reason", "Notification verify %");
    await admin.from("messages").delete().like("client_request_id", `${testPrefix}%`);
    await admin.from("calls").delete().like("client_request_id", `${testPrefix}%`);
    await clearProjection();
  }

  await cleanupDomain();
  await admin.from("feature_flags").update({ enabled: true }).eq("key", "friends");

  const { data: profiles } = await admin.from("profiles")
    .select("id,username")
    .in("id", [a.userId, b.userId]);
  const usernameA = profiles?.find((profile) => profile.id === a.userId)?.username;
  if (!usernameA) throw new Error("Seeded username is missing");

  // Own private topic succeeds; another user's topic fails closed.
  await a.client.realtime.setAuth();
  let ownReadyResolve: (ready: boolean) => void = () => undefined;
  const ownReady = new Promise<boolean>((resolve) => { ownReadyResolve = resolve; });
  let ownEventResolve: (payload: Record<string, unknown> | null) => void = () => undefined;
  const ownEvent = new Promise<Record<string, unknown> | null>((resolve) => { ownEventResolve = resolve; });
  const ownChannel = a.client
    .channel(`notifications:user:${a.userId}`, { config: { private: true } })
    .on("broadcast", { event: "notifications.changed" }, ({ payload }) => ownEventResolve(payload))
    .subscribe((status) => {
      if (status === "SUBSCRIBED") ownReadyResolve(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") ownReadyResolve(false);
    });
  report("recipient can subscribe to their private notification topic", await Promise.race([
    ownReady,
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]));

  let foreignResolve: (ready: boolean) => void = () => undefined;
  const foreignReady = new Promise<boolean>((resolve) => { foreignResolve = resolve; });
  const foreignChannel = a.client
    .channel(`notifications:user:${b.userId}`, { config: { private: true } })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") foreignResolve(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") foreignResolve(false);
    });
  report("another recipient's notification topic is denied", !(await Promise.race([
    foreignReady,
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ])));

  const { data: announcement, error: announcementError } = await admin.rpc(
    "publish_system_announcement",
    {
      p_kind: "system_announcement",
      p_title: "Notification verify announcement",
      p_body: "A calm system update.",
      p_action_href: "/home",
      p_audience_role: "client",
      p_category: "update",
    },
  );
  if (announcementError) throw announcementError;
  const broadcast = await Promise.race([
    ownEvent,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
  ]);
  report("new persisted notifications emit a minimal realtime wakeup", Boolean(
    broadcast?.itemId && typeof broadcast.changeSeq === "number" && broadcast.reason,
  ), JSON.stringify(broadcast));
  let aItems = await list(a.client);
  const announcementItem = aItems.find((item) =>
    item.kind === "system_announcement" && item.title === "Notification verify announcement"
  );
  report("system announcements hydrate with safe content and a local action", aItems.some((item) =>
    item.kind === "system_announcement" && item.title === "Notification verify announcement" && item.action_href === "/home"
  ));

  const { data: expiringAnnouncement, error: expiringAnnouncementError } =
    await admin.rpc("publish_system_announcement", {
      p_kind: "product_update",
      p_title: "Notification verify expiring update",
      p_body: "This update should leave the inbox when it expires.",
      p_audience_role: "client",
      p_expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
  if (expiringAnnouncementError) throw expiringAnnouncementError;
  const { data: summaryBeforeExpiry } = await a.client.rpc("get_notification_summary");
  const visibleBeforeExpiry = (await list(a.client)).some((item) =>
    item.title === "Notification verify expiring update"
  );
  const expiredAt = new Date(Date.now() - 1_000);
  const { error: expireError } = await admin
    .from("system_announcements")
    .update({
      starts_at: new Date(expiredAt.getTime() - 60_000).toISOString(),
      expires_at: expiredAt.toISOString(),
    })
    .eq("id", expiringAnnouncement.id);
  if (expireError) throw expireError;
  const { data: summaryAfterExpiry } = await a.client.rpc("get_notification_summary");
  report(
    "expired announcements leave both the feed and attention summary",
    visibleBeforeExpiry &&
      !(await list(a.client)).some((item) =>
        item.title === "Notification verify expiring update"
      ) &&
      Number(summaryAfterExpiry?.[0]?.unseen_count ?? 0) <
        Number(summaryBeforeExpiry?.[0]?.unseen_count ?? 0),
  );

  const { data: moderation, error: moderationError } = await admin.rpc(
    "create_moderation_action",
    {
      p_recipient_id: a.userId,
      p_action_type: "account_notice",
      p_reason: "Notification verify moderation guidance.",
      p_requires_acknowledgement: true,
    },
  );
  if (moderationError) throw moderationError;
  const moderationItem = (await list(a.client)).find((item) => item.kind === "moderation_action");
  if (!moderationItem) throw new Error("Moderation notification was not created");
  await a.client.rpc("mark_notifications_read", {
    p_notification_ids: [moderationItem.id, announcementItem?.id].filter(Boolean),
    p_through_change_seq: Math.max(
      Number(moderationItem.change_seq),
      Number(announcementItem?.change_seq ?? 0),
    ),
  });
  const { data: archiveResult } = await a.client.rpc("archive_read_notifications", {
    p_through_change_seq: Number.MAX_SAFE_INTEGER,
  });
  aItems = await list(a.client);
  report("clear-read never removes unresolved action-required moderation", aItems.some((item) =>
    item.id === moderationItem?.id
  ));
  const { data: acknowledged } = await a.client.rpc("acknowledge_moderation_action", {
    p_action_id: moderation.id,
  });
  report("recipient acknowledgement resolves the moderation notification", acknowledged === true &&
    !(await list(a.client)).some((item) => item.id === moderationItem?.id));
  const archiveBatchId = (archiveResult as { archiveBatchId?: string } | null)?.archiveBatchId;
  if (archiveBatchId) {
    const { data: restored } = await a.client.rpc("restore_notification_batch", {
      p_archive_batch_id: archiveBatchId,
    });
    report("clear-read batches can be restored exactly", typeof restored === "number" && restored > 0);
  } else {
    report("clear-read batches can be restored exactly", false, "archive token missing");
  }

  const { data: request, error: requestError } = await b.client.rpc("send_friend_request", {
    p_target_id: a.userId,
    p_client_request_id: `${testPrefix}${crypto.randomUUID()}`,
  });
  if (requestError) throw requestError;
  report("friend requests become action-required notifications", (await list(a.client)).some((item) =>
    item.kind === "friend_request_received" && item.friend_request_id === request.id
  ));
  await a.client.rpc("respond_friend_request", { p_request_id: request.id, p_response: "accept" });
  report("resolving a request retracts it and notifies the sender", !(await list(a.client)).some((item) =>
    item.kind === "friend_request_received" && item.friend_request_id === request.id
  ) && (await list(b.client)).some((item) => item.kind === "friend_request_accepted"));

  const { data: mentionMessage, error: mentionError } = await b.client.rpc("send_chat_message", {
    p_conversation_id: "11111111-1111-4111-8111-111111111111",
    p_body: `Notification verify @${usernameA}`,
    p_client_request_id: `${testPrefix}${crypto.randomUUID()}`,
  });
  if (mentionError) throw mentionError;
  report("mentions persist a directed notification", (await list(a.client)).some((item) =>
    item.kind === "message_mention" && item.message_id === mentionMessage.id
  ));
  await b.client.rpc("edit_chat_message", {
    p_message_id: mentionMessage.id,
    p_body: "Notification verify mention removed",
  });
  report("editing away a mention retracts the notification", !(await list(a.client)).some((item) =>
    item.message_id === mentionMessage.id
  ));

  const { data: reactionTarget, error: targetError } = await a.client.rpc("send_chat_message", {
    p_conversation_id: "11111111-1111-4111-8111-111111111111",
    p_body: "Notification verify reaction target",
    p_client_request_id: `${testPrefix}${crypto.randomUUID()}`,
  });
  if (targetError) throw targetError;
  await b.client.rpc("toggle_message_reaction", { p_message_id: reactionTarget.id, p_emoji: "👍" });
  await member.client.rpc("toggle_message_reaction", { p_message_id: reactionTarget.id, p_emoji: "✨" });
  const reactionItem = (await list(a.client)).find((item) =>
    item.kind === "message_reaction" && item.message_id === reactionTarget.id
  );
  report("reactions collapse by message with actor and event counts", reactionItem?.event_count === 2 &&
    reactionItem?.actor_count === 2);

  const { data: ringing, error: callError } = await coach.client.rpc("initiate_call", {
    p_recipient_id: a.userId,
    p_kind: "audio",
    p_client_request_id: `${testPrefix}${crypto.randomUUID()}`,
  });
  if (callError) throw callError;
  await admin.rpc("expire_stale_calls", {
    p_now: new Date(Date.parse(ringing.expires_at) + 1_000).toISOString(),
  });
  report("missed calls create unread direct notifications", (await list(a.client)).some((item) =>
    item.kind === "call_missed" && item.call_id === ringing.id && item.read_at === null
  ));

  const { data: completedCall, error: completedCallError } = await coach.client.rpc("initiate_call", {
    p_recipient_id: a.userId,
    p_kind: "video",
    p_client_request_id: `${testPrefix}${crypto.randomUUID()}`,
  });
  if (completedCallError) throw completedCallError;
  await a.client.rpc("accept_call", { p_call_id: completedCall.id });
  await coach.client.rpc("end_call", { p_call_id: completedCall.id });
  report("completed calls do not create new notification attention", !(await list(a.client)).some((item) =>
    item.kind === "call_completed" && item.call_id === completedCall.id
  ));

  const { data: attention, error: attentionError } = await a.client.rpc("list_navigation_attention");
  if (attentionError) throw attentionError;
  const generalAttention = attention.find((item: { entity_id: string }) =>
    item.entity_id === "22222222-2222-4222-8222-222222222222"
  );
  report("navigation attention separates unread activity from mention counts", Boolean(
    generalAttention && generalAttention.unread_count >= generalAttention.mention_count &&
      typeof generalAttention.new_activity === "boolean"
  ));

  const { data: aConversations, error: privateConversationError } = await admin
    .from("conversations")
    .select("id")
    .eq("client_id", a.userId)
    .eq("coach_id", coach.userId);
  if (privateConversationError) throw privateConversationError;
  const { data: channelConversations, error: channelConversationError } = await admin
    .from("channels")
    .select("conversation_id");
  if (channelConversationError) throw channelConversationError;
  const channelConversationIds = new Set(
    (channelConversations ?? []).map((channel) => channel.conversation_id),
  );
  const privateConversationId = (aConversations ?? []).find(
    (conversation) => !channelConversationIds.has(conversation.id),
  )?.id;
  if (!privateConversationId) {
    report("conversation attention topics enforce membership", false, "direct conversation missing");
    report("conversation activity emits a shared realtime wakeup", false, "direct conversation missing");
  } else {
    await b.client.realtime.setAuth();
    let attentionReadyResolve: (ready: boolean) => void = () => undefined;
    const attentionReady = new Promise<boolean>((resolve) => {
      attentionReadyResolve = resolve;
    });
    let attentionEventResolve: (payload: Record<string, unknown> | null) => void = () => undefined;
    const attentionEvent = new Promise<Record<string, unknown> | null>((resolve) => {
      attentionEventResolve = resolve;
    });
    const attentionChannel = a.client
      .channel(`attention:conversation:${privateConversationId}`, { config: { private: true } })
      .on("broadcast", { event: "attention.changed" }, ({ payload }) => {
        attentionEventResolve(payload);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") attentionReadyResolve(true);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") attentionReadyResolve(false);
      });
    const attentionSubscribed = await Promise.race([
      attentionReady,
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);

    let deniedAttentionResolve: (ready: boolean) => void = () => undefined;
    const deniedAttentionReady = new Promise<boolean>((resolve) => {
      deniedAttentionResolve = resolve;
    });
    const deniedAttentionChannel = b.client
      .channel(`attention:conversation:${privateConversationId}`, { config: { private: true } })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") deniedAttentionResolve(true);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          deniedAttentionResolve(false);
        }
      });
    const foreignAttentionSubscribed = await Promise.race([
      deniedAttentionReady,
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    report(
      "conversation attention topics enforce membership",
      attentionSubscribed && !foreignAttentionSubscribed,
    );

    if (attentionSubscribed) {
      const { error: attentionMessageError } = await coach.client.rpc("send_chat_message", {
        p_conversation_id: privateConversationId,
        p_body: "Notification verify attention wakeup",
        p_client_request_id: `${testPrefix}${crypto.randomUUID()}`,
      });
      if (attentionMessageError) throw attentionMessageError;
    }
    const attentionBroadcast = await Promise.race([
      attentionEvent,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
    ]);
    report("conversation activity emits a shared realtime wakeup", Boolean(
      attentionBroadcast?.conversationId === privateConversationId &&
        attentionBroadcast.reason === "message",
    ), JSON.stringify(attentionBroadcast));
    await Promise.all([
      a.client.removeChannel(attentionChannel),
      b.client.removeChannel(deniedAttentionChannel),
    ]);
  }

  // Snapshot command must not acknowledge a notification created afterward.
  const { data: beforeSummary } = await a.client.rpc("get_notification_summary");
  const through = beforeSummary?.[0]?.latest_change_seq ?? 0;
  const { data: lateAnnouncement } = await admin.rpc("publish_system_announcement", {
    p_kind: "product_update",
    p_title: "Notification verify late update",
    p_body: "Created after the bulk snapshot.",
    p_audience_role: "client",
  });
  await a.client.rpc("mark_all_notifications_read", { p_through_change_seq: through });
  report("bulk read is snapshot-safe against newly arrived notifications", (await list(a.client, "unread")).some((item) =>
    item.title === "Notification verify late update"
  ));

  // Keyset pagination has no duplicates and a strict continuation.
  for (let index = 0; index < 7; index += 1) {
    await admin.rpc("publish_system_announcement", {
      p_kind: "product_update",
      p_title: `Notification verify page ${index}`,
      p_body: "Pagination verification.",
      p_audience_role: "client",
    });
  }
  const firstPage = await list(a.client, "all", 5);
  const last = firstPage[4] as { category_rank: number; last_event_at: string; id: string };
  const secondPage = await list(a.client, "all", 5, last);
  report("keyset pages continue without duplicate items", firstPage.length === 6 && secondPage.length > 0 &&
    !new Set(firstPage.slice(0, 5).map((item) => item.id)).has(secondPage[0]?.id));

  const { data: leaked } = await b.client.from("notification_items")
    .select("recipient_id")
    .neq("recipient_id", b.userId);
  report("RLS never exposes another recipient's persisted inbox", leaked?.length === 0);

  await Promise.all([
    a.client.removeChannel(ownChannel),
    a.client.removeChannel(foreignChannel),
  ]);
  void announcement;
  void lateAnnouncement;
  await cleanupDomain();

  if (failures > 0) {
    console.error(`\n${failures} notification verification check(s) failed.`);
    process.exit(1);
  }
  console.log("\nNotification verification passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
