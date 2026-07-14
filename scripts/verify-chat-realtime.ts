import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const coachCreds = { email: "coach@fish.dev", password: "fish-coach-dev" };
const unassignedCoachCreds = {
  email: "coach2@fish.dev",
  password: "fish-coach-dev",
};
const clientCreds = { email: "client1@fish.dev", password: "fish-client-dev" };
const runId = `verify-realtime-${Date.now()}`;

type JsonRecord = Record<string, unknown>;

type SignedInUser = {
  client: SupabaseClient;
  userId: string;
  accessToken: string;
  email: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  client_request_id: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_message_id?: string | null;
  reactions?: Array<{ emoji: string; count: number; by_me: boolean }>;
};

let failures = 0;

function report(label: string, ok: boolean, detail?: string): void {
  const line = `${ok ? "PASS" : "FAIL"} - ${label}${detail ? ` (${detail})` : ""}`;
  console.log(line);
  if (!ok) failures += 1;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function randomId(): string {
  return crypto.randomUUID();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sameOrLaterInstant(value: string | null | undefined, reference: string): boolean {
  return Boolean(value) && Date.parse(value!) >= Date.parse(reference);
}

async function waitFor<T>(
  label: string,
  read: () => T | undefined | null,
  timeoutMs = 10_000,
): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = read();
    if (value) return value;
    await delay(50);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function messageMarkerCovers(
  conversationId: string,
  markerMessageId: string | null | undefined,
  targetMessageId: string,
): Promise<boolean> {
  if (!markerMessageId) return false;
  if (markerMessageId === targetMessageId) return true;

  const { data, error } = await admin
    .from("messages")
    .select("id, created_at")
    .eq("conversation_id", conversationId)
    .in("id", [markerMessageId, targetMessageId]);
  if (error || !data || data.length !== 2) {
    return false;
  }

  const marker = data.find((row) => row.id === markerMessageId);
  const target = data.find((row) => row.id === targetMessageId);
  if (!marker || !target) return false;

  const byTime = marker.created_at.localeCompare(target.created_at);
  return byTime > 0 || (byTime === 0 && marker.id.localeCompare(target.id) >= 0);
}

async function checked(label: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    report(label, true);
  } catch (error) {
    report(label, false, error instanceof Error ? error.message : String(error));
  }
}

async function signInAs(creds: { email: string; password: string }): Promise<SignedInUser> {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 40,
      },
    },
  });

  const { data, error } = await client.auth.signInWithPassword(creds);
  if (error || !data.user || !data.session) {
    throw new Error(error?.message ?? `No session for ${creds.email}`);
  }

  client.realtime.setAuth(data.session.access_token);
  return {
    client,
    userId: data.user.id,
    accessToken: data.session.access_token,
    email: creds.email,
  };
}

async function edgeRequest<T>(
  functionName: "send-message" | "chat-command",
  session: SignedInUser,
  body: JsonRecord,
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${functionName} ${response.status}: ${text}`);
  }

  return payload as T;
}

function unwrapMessage(payload: unknown): MessageRow {
  const record = payload as { message?: unknown };
  const value = Array.isArray(record.message) ? record.message[0] : record.message;
  assertCondition(typeof value === "object" && value !== null, "message payload missing");
  const message = value as MessageRow;
  assertCondition(typeof message.id === "string", "message id missing");
  return message;
}

async function sendMessage(
  session: SignedInUser,
  conversationId: string,
  body: string,
  clientRequestId: string,
  replyToMessageId: string | null = null,
): Promise<MessageRow> {
  return unwrapMessage(
    await edgeRequest("send-message", session, {
      conversationId,
      body,
      clientRequestId,
      replyToMessageId,
    }),
  );
}

async function chatCommand<T>(session: SignedInUser, body: JsonRecord): Promise<T> {
  return edgeRequest<T>("chat-command", session, body);
}

async function getUnreadSummary(
  session: SignedInUser,
  conversationId: string,
): Promise<{
  unread_count: number;
  oldest_unread_at: string | null;
  latest_unread_message_id: string | null;
}> {
  const { data, error } = await session.client.rpc("get_chat_unread_summary", {
    p_conversation_id: conversationId,
  });
  if (error || !data?.[0]) {
    throw new Error(error?.message ?? "Unread summary was unavailable");
  }
  return data[0] as {
    unread_count: number;
    oldest_unread_at: string | null;
    latest_unread_message_id: string | null;
  };
}

async function subscribeChannel(channel: RealtimeChannel, label: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} subscription timed out`));
    }, 10_000);

    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        reject(new Error(`${label} subscription ${status}${error ? `: ${String(error)}` : ""}`));
      }
    });
  });
}

async function createPostgresCollector(
  session: SignedInUser,
  label: string,
  table: string,
  filter: string,
) {
  const payloads: JsonRecord[] = [];
  const channel = session.client
    .channel(`${label}:${randomId()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter },
      (payload) => {
        payloads.push(payload as JsonRecord);
      },
    );

  await subscribeChannel(channel, label);

  return {
    payloads,
    async close() {
      await session.client.removeChannel(channel);
    },
  };
}

async function createBroadcastPair(
  sender: SignedInUser,
  receiver: SignedInUser,
  topic: string,
  eventName: string,
) {
  const payloads: JsonRecord[] = [];
  const receiverChannel = receiver.client
    .channel(topic, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: eventName }, (payload) => {
      payloads.push(payload as JsonRecord);
    });
  const senderChannel = sender.client.channel(topic, {
    config: { broadcast: { self: false } },
  });

  await Promise.all([
    subscribeChannel(receiverChannel, `${topic}:receiver`),
    subscribeChannel(senderChannel, `${topic}:sender`),
  ]);

  return {
    payloads,
    async send(payload: JsonRecord) {
      await senderChannel.send({ type: "broadcast", event: eventName, payload });
    },
    async close() {
      await Promise.all([
        sender.client.removeChannel(senderChannel),
        receiver.client.removeChannel(receiverChannel),
      ]);
    },
  };
}

async function main(): Promise<void> {
  console.log(`Realtime chat verification run: ${runId}`);

  await checked("Edge routes are served and protected by JWT", async () => {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat-command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assertCondition(response.status === 401, `expected 401, got ${response.status}`);
  });

  const coach = await signInAs(coachCreds);
  const client = await signInAs(clientCreds);
  const clientTab = await signInAs(clientCreds);

  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .select("id, client_id, coach_id")
    .eq("client_id", client.userId)
    .eq("coach_id", coach.userId)
    .single();
  if (conversationError || !conversation) {
    throw new Error(conversationError?.message ?? "Seeded conversation missing");
  }
  const conversationId = conversation.id as string;

  await checked("Unread summary is restricted to conversation members", async () => {
    const anonymous = createClient(supabaseUrl!, publishableKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonymousResult = await anonymous.rpc("get_chat_unread_summary", {
      p_conversation_id: conversationId,
    });
    assertCondition(
      Boolean(anonymousResult.error),
      "anonymous caller unexpectedly received unread metadata",
    );

    const unassignedCoach = await signInAs(unassignedCoachCreds);
    try {
      const outsiderResult = await unassignedCoach.client.rpc(
        "get_chat_unread_summary",
        { p_conversation_id: conversationId },
      );
      assertCondition(
        Boolean(outsiderResult.error),
        "non-member unexpectedly received unread metadata",
      );
    } finally {
      await unassignedCoach.client.auth.signOut();
    }
  });

  const coachMessageEvents = await createPostgresCollector(
    coach,
    "coach-message-events",
    "messages",
    `conversation_id=eq.${conversationId}`,
  );
  let clientMessageEvents = await createPostgresCollector(
    client,
    "client-message-events",
    "messages",
    `conversation_id=eq.${conversationId}`,
  );
  const clientReadEvents = await createPostgresCollector(
    client,
    "client-read-events",
    "message_reads",
    `conversation_id=eq.${conversationId}`,
  );
  const clientReactionEvents = await createPostgresCollector(
    client,
    "client-reaction-events",
    "message_reactions",
    `conversation_id=eq.${conversationId}`,
  );
  const coachPresenceEvents = await createPostgresCollector(
    coach,
    "coach-presence-events",
    "presence_sessions",
    `user_id=eq.${client.userId}`,
  );

  const openChannels = [
    coachMessageEvents,
    clientReadEvents,
    clientReactionEvents,
    coachPresenceEvents,
  ];

  await checked("Presence sync supports multiple tabs, activity, and offline transition", async () => {
    const sessionA = randomId();
    const sessionB = randomId();
    const now = new Date().toISOString();

    const { error: upsertAError } = await client.client.from("presence_sessions").upsert(
      {
        id: sessionA,
        user_id: client.userId,
        active_at: now,
        last_heartbeat_at: now,
        ended_at: null,
      },
      { onConflict: "id" },
    );
    if (upsertAError) throw upsertAError;

    const { error: upsertBError } = await clientTab.client.from("presence_sessions").upsert(
      {
        id: sessionB,
        user_id: client.userId,
        active_at: now,
        last_heartbeat_at: now,
        ended_at: null,
      },
      { onConflict: "id" },
    );
    if (upsertBError) throw upsertBError;

    await waitFor("presence inserts", () => {
      const ids = new Set(
        coachPresenceEvents.payloads
          .map((payload) => (payload.new as { id?: string } | undefined)?.id)
          .filter(Boolean),
      );
      return ids.has(sessionA) && ids.has(sessionB) ? true : null;
    });

    const activeAt = new Date(Date.now() + 1000).toISOString();
    const { error: activeError } = await client.client
      .from("presence_sessions")
      .update({ active_at: activeAt, last_heartbeat_at: activeAt })
      .eq("id", sessionA);
    if (activeError) throw activeError;

    await waitFor("presence activity update", () =>
      coachPresenceEvents.payloads.some((payload) => {
        const row = payload.new as { id?: string; active_at?: string } | undefined;
        return row?.id === sessionA && sameOrLaterInstant(row.active_at, activeAt);
      })
        ? true
        : null,
    );

    const endedAt = new Date(Date.now() + 2000).toISOString();
    const { error: endError } = await client.client
      .from("presence_sessions")
      .update({ ended_at: endedAt, last_heartbeat_at: endedAt })
      .eq("id", sessionA);
    if (endError) throw endError;

    await waitFor("presence offline update", () =>
      coachPresenceEvents.payloads.some((payload) => {
        const row = payload.new as { id?: string; ended_at?: string | null } | undefined;
        return row?.id === sessionA && sameOrLaterInstant(row.ended_at, endedAt);
      })
        ? true
        : null,
    );

    const { data: rows, error: readError } = await coach.client
      .from("presence_sessions")
      .select("id, ended_at")
      .in("id", [sessionA, sessionB]);
    if (readError) throw readError;

    assertCondition(rows?.length === 2, `expected two visible presence sessions, got ${rows?.length ?? 0}`);
    assertCondition(
      rows.some((row) => row.id === sessionB && row.ended_at === null),
      "second tab should remain online",
    );
  });

  await checked("Typing and voice recording broadcasts cross clients in real time", async () => {
    const typing = await createBroadcastPair(
      client,
      coach,
      `conversation:${conversationId}:typing`,
      "typing",
    );
    const voice = await createBroadcastPair(
      coach,
      client,
      `conversation:${conversationId}:voice-recording`,
      "voice-recording",
    );
    try {
      await typing.send({ userId: client.userId, typing: true });
      await waitFor("typing true", () =>
        typing.payloads.some((payload) => {
          const data = payload.payload as { userId?: string; typing?: boolean } | undefined;
          return data?.userId === client.userId && data.typing === true;
        })
          ? true
          : null,
      );

      await typing.send({ userId: client.userId, typing: false });
      await waitFor("typing false", () =>
        typing.payloads.some((payload) => {
          const data = payload.payload as { userId?: string; typing?: boolean } | undefined;
          return data?.userId === client.userId && data.typing === false;
        })
          ? true
          : null,
      );

      await voice.send({ userId: coach.userId, recording: true });
      await waitFor("voice recording true", () =>
        voice.payloads.some((payload) => {
          const data = payload.payload as { userId?: string; recording?: boolean } | undefined;
          return data?.userId === coach.userId && data.recording === true;
        })
          ? true
          : null,
      );
    } finally {
      await typing.close();
      await voice.close();
    }
  });

  let firstMessage: MessageRow | null = null;
  await checked("Edge send delivers one realtime message and deduplicates retries", async () => {
    const requestId = `${runId}-first`;
    firstMessage = await sendMessage(client, conversationId, "Realtime verifier first message", requestId);

    await waitFor("coach receives first message", () =>
      coachMessageEvents.payloads.some((payload) => {
        const row = payload.new as { id?: string } | undefined;
        return row?.id === firstMessage?.id;
      })
        ? true
        : null,
    );

    const duplicate = await sendMessage(
      client,
      conversationId,
      "Realtime verifier first message",
      requestId,
    );
    assertCondition(duplicate.id === firstMessage.id, "retry returned a different message id");

    const { count, error } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("client_request_id", requestId);
    if (error) throw error;
    assertCondition(count === 1, `expected one stored message for retry id, got ${count ?? 0}`);
  });

  const rapidMessages: MessageRow[] = [];
  await checked("Rapid sends keep consistent ordering", async () => {
    assertCondition(firstMessage, "first message missing");
    const sends = Array.from({ length: 5 }, (_, index) =>
      sendMessage(
        client,
        conversationId,
        `Realtime verifier rapid ${index + 1}`,
        `${runId}-rapid-${index + 1}`,
      ),
    );
    rapidMessages.push(...(await Promise.all(sends)));

    await waitFor("coach receives rapid messages", () => {
      const seen = new Set(
        coachMessageEvents.payloads
          .map((payload) => (payload.new as { id?: string } | undefined)?.id)
          .filter(Boolean),
      );
      return rapidMessages.every((message) => seen.has(message.id)) ? true : null;
    });

    const ids = [firstMessage.id, ...rapidMessages.map((message) => message.id)];
    const { data, error } = await client.client
      .from("messages")
      .select("id, created_at")
      .in("id", ids)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;

    const orderedIds = (data ?? []).map((row) => row.id);
    const sortedIds = [...(data ?? [])]
      .sort((a, b) => {
        const byTime = a.created_at.localeCompare(b.created_at);
        return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
      })
      .map((row) => row.id);
    assertCondition(JSON.stringify(orderedIds) === JSON.stringify(sortedIds), "database order was inconsistent");
  });

  let replyMessage: MessageRow | null = null;
  await checked("Replies, edits, reactions, read receipts, and deletes update in real time", async () => {
    assertCondition(firstMessage, "first message missing");
    const unreadBeforeReply = await getUnreadSummary(client, conversationId);
    replyMessage = await sendMessage(
      coach,
      conversationId,
      "Reply from realtime verifier",
      `${runId}-reply`,
      firstMessage.id,
    );
    assertCondition(replyMessage.reply_to_message_id === firstMessage.id, "reply target was not preserved");

    const unreadAfterReply = await getUnreadSummary(client, conversationId);
    assertCondition(
      unreadAfterReply.unread_count === unreadBeforeReply.unread_count + 1,
      `incoming reply should add exactly one unread message, got ${unreadAfterReply.unread_count}`,
    );
    assertCondition(
      unreadAfterReply.latest_unread_message_id === replyMessage.id,
      "unread summary did not identify the newest incoming message",
    );
    assertCondition(
      Boolean(unreadAfterReply.oldest_unread_at),
      "unread summary did not include the oldest unread timestamp",
    );

    await chatCommand(client, {
      action: "mark-read-state",
      conversationId,
      lastDeliveredMessageId: replyMessage.id,
      lastReadMessageId: null,
    });
    const unreadAfterDelivery = await getUnreadSummary(client, conversationId);
    assertCondition(
      unreadAfterDelivery.unread_count === unreadAfterReply.unread_count,
      "delivery-only update must not clear unread messages",
    );

    await chatCommand(client, {
      action: "mark-read-state",
      conversationId,
      lastDeliveredMessageId: replyMessage.id,
      lastReadMessageId: replyMessage.id,
    });
    const unreadAfterRead = await getUnreadSummary(client, conversationId);
    assertCondition(
      unreadAfterRead.unread_count === 0 &&
        unreadAfterRead.oldest_unread_at === null &&
        unreadAfterRead.latest_unread_message_id === null,
      "explicit read update did not clear the unread summary",
    );

    const deletedUnread = await sendMessage(
      coach,
      conversationId,
      "Temporary unread message for delete verification",
      `${runId}-deleted-unread`,
    );
    const unreadBeforeDelete = await getUnreadSummary(client, conversationId);
    assertCondition(
      unreadBeforeDelete.unread_count === 1 &&
        unreadBeforeDelete.latest_unread_message_id === deletedUnread.id,
      "new incoming message did not become unread before deletion",
    );
    await chatCommand(coach, {
      action: "delete-message",
      messageId: deletedUnread.id,
    });
    const unreadAfterDelete = await getUnreadSummary(client, conversationId);
    assertCondition(
      unreadAfterDelete.unread_count === 0 &&
        unreadAfterDelete.oldest_unread_at === null &&
        unreadAfterDelete.latest_unread_message_id === null,
      "deleted messages must not remain in the unread summary",
    );

    const edited = unwrapMessage(
      await chatCommand(coach, {
        action: "edit-message",
        messageId: replyMessage.id,
        body: "Edited reply from realtime verifier",
      }),
    );
    assertCondition(edited.body === "Edited reply from realtime verifier", "edit response body mismatch");

    await waitFor("message edit realtime update", () =>
      clientMessageEvents.payloads.some((payload) => {
        const row = payload.new as { id?: string; edited_at?: string | null; body?: string } | undefined;
        return row?.id === replyMessage?.id && Boolean(row.edited_at) && row.body === edited.body;
      })
        ? true
        : null,
    );

    await chatCommand(coach, {
      action: "toggle-reaction",
      messageId: firstMessage.id,
      emoji: "👍",
    });
    await waitFor("reaction realtime insert", () =>
      clientReactionEvents.payloads.some((payload) => {
        const row = payload.new as
          | { message_id?: string; emoji?: string; removed_at?: string | null }
          | undefined;
        return row?.message_id === firstMessage?.id && row.emoji === "👍" && row.removed_at === null;
      })
        ? true
        : null,
    );

    const refreshed = await chatCommand<{ messages: MessageRow[] }>(client, {
      action: "refresh-messages",
      messageIds: [firstMessage.id],
    });
    const refreshedFirst = refreshed.messages[0];
    assertCondition(
      refreshedFirst.reactions?.some((reaction) => reaction.emoji === "👍" && reaction.count === 1),
      "refresh-messages did not include reaction aggregate",
    );

    const readTargetId = replyMessage.id;
    const readResponse = await chatCommand<{ readState?: JsonRecord }>(coach, {
      action: "mark-read-state",
      conversationId,
      lastDeliveredMessageId: readTargetId,
      lastReadMessageId: readTargetId,
    });
    assertCondition(
      await messageMarkerCovers(
        conversationId,
        readResponse.readState?.last_read_message_id as string | null | undefined,
        readTargetId,
      ),
      "read state response did not cover requested message",
    );

    const readReceiptRow = await waitFor("read receipt realtime update", () =>
      clientReadEvents.payloads
        .map((payload) => payload.new as
          | { user_id?: string; last_read_message_id?: string | null }
          | undefined)
        .find((row) => row?.user_id === coach.userId && row.last_read_message_id) ?? null
    );
    assertCondition(
      await messageMarkerCovers(
        conversationId,
        (readReceiptRow as { last_read_message_id?: string | null }).last_read_message_id,
        readTargetId,
      ),
      "read receipt realtime update did not cover requested message",
    );

    const deleted = unwrapMessage(
      await chatCommand(coach, {
        action: "delete-message",
        messageId: replyMessage.id,
      }),
    );
    assertCondition(Boolean(deleted.deleted_at), "delete response missing deleted_at");

    await waitFor("delete realtime update", () =>
      clientMessageEvents.payloads.some((payload) => {
        const row = payload.new as { id?: string; deleted_at?: string | null } | undefined;
        return row?.id === replyMessage?.id && Boolean(row.deleted_at);
      })
        ? true
        : null,
    );
  });

  await checked("Reconnect backfill finds messages sent while unsubscribed", async () => {
    await clientMessageEvents.close();

    const offlineMessage = await sendMessage(
      coach,
      conversationId,
      "Message sent while client subscription is offline",
      `${runId}-offline`,
    );

    clientMessageEvents = await createPostgresCollector(
      client,
      "client-message-events-reconnected",
      "messages",
      `conversation_id=eq.${conversationId}`,
    );

    const refreshed = await chatCommand<{ messages: MessageRow[]; readStates: JsonRecord[] }>(client, {
      action: "refresh-conversation",
      conversationId,
    });
    assertCondition(
      refreshed.messages.some((message) => message.id === offlineMessage.id),
      "refresh-conversation missed offline message",
    );

    const afterReconnect = await sendMessage(
      coach,
      conversationId,
      "Message after client subscription reconnect",
      `${runId}-after-reconnect`,
    );
    await waitFor("post-reconnect realtime delivery", () =>
      clientMessageEvents.payloads.some((payload) => {
        const row = payload.new as { id?: string } | undefined;
        return row?.id === afterReconnect.id;
      })
        ? true
        : null,
    );
  });

  openChannels.push(clientMessageEvents);
  await Promise.all(openChannels.map((collector) => collector.close()));
  await Promise.all([coach.client.auth.signOut(), client.client.auth.signOut(), clientTab.client.auth.signOut()]);

  if (failures > 0) {
    console.error(`Realtime chat verification failed with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("Realtime chat verification passed.");
  process.exit(0);
}

await main();
