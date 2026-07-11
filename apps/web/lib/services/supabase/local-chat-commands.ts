import type {
  BackfillMessagesInput,
  ChatMessageCommand,
  ChatOperationResult,
  ClientChatMessage,
  ClientChatReadState,
  ConversationInput,
  LoadNewestMessagesInput,
  LoadOlderMessagesInput,
  MarkReadStateInput,
  RefreshMessagesInput,
  SendMessageInput,
} from "../contracts";
import { createServerSupabaseClient } from "./server";
import {
  chatOlderPageSize,
  mapChatErrorNotice,
  type MessageResponseRow,
  type ReadStateResponseRow,
  reactionPageSize,
  saveNotice,
  sendNotice,
  toClientChatMessage,
  toClientReadState,
} from "./chat-mapping";

async function getLocalFallbackContext(): Promise<{
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
} | null> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return { client, userId: data.user.id };
}

function aggregateReactions(
  rows: Array<{ message_id: string; emoji: string; user_id: string }>,
  currentUserId: string
): Map<string, MessageResponseRow["reactions"]> {
  const grouped = new Map<
    string,
    Map<string, { emoji: string; count: number; by_me: boolean }>
  >();

  for (const row of rows) {
    const reactions = grouped.get(row.message_id) ?? new Map();
    const current = reactions.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      by_me: false,
    };
    reactions.set(row.emoji, {
      emoji: row.emoji,
      count: current.count + 1,
      by_me: current.by_me || row.user_id === currentUserId,
    });
    grouped.set(row.message_id, reactions);
  }

  return new Map(
    Array.from(grouped.entries()).map(([messageId, reactions]) => [
      messageId,
      Array.from(reactions.values()),
    ])
  );
}

async function addReactionAggregates(
  context: NonNullable<Awaited<ReturnType<typeof getLocalFallbackContext>>>,
  messages: MessageResponseRow[]
): Promise<MessageResponseRow[]> {
  const ids = messages.map((message) => message.id);
  if (ids.length === 0) {
    return messages;
  }

  const reactionRows: Array<{ message_id: string; emoji: string; user_id: string }> = [];

  for (let batchStart = 0; batchStart < ids.length; batchStart += 25) {
    const batchIds = ids.slice(batchStart, batchStart + 25);
    for (let from = 0;; from += reactionPageSize) {
      const { data, error } = await context.client
        .from("message_reactions")
        .select("message_id, emoji, user_id")
        .in("message_id", batchIds)
        .is("removed_at", null)
        .range(from, from + reactionPageSize - 1);

      if (error) {
        return messages.map((message) => ({ ...message, reactions: [] }));
      }

      reactionRows.push(
        ...(data ?? []).map((row) => ({
          message_id: row.message_id,
          emoji: row.emoji,
          user_id: row.user_id,
        }))
      );

      if ((data ?? []).length < reactionPageSize) {
        break;
      }
    }
  }

  const reactionsByMessage = aggregateReactions(
    reactionRows,
    context.userId
  );

  return messages.map((message) => ({
    ...message,
    reactions: reactionsByMessage.get(message.id) ?? [],
  }));
}

async function addSenderDisplayNames(
  context: NonNullable<Awaited<ReturnType<typeof getLocalFallbackContext>>>,
  messages: MessageResponseRow[]
): Promise<MessageResponseRow[]> {
  const senderIds = Array.from(new Set(messages.map((message) => message.sender_id)));
  if (senderIds.length === 0) {
    return messages;
  }

  let response: {
    data: Array<{ id: string; display_name: string }> | null;
    error: unknown;
  };

  try {
    response = await context.client
      .from("profiles")
      .select("id, display_name")
      .in("id", senderIds);
  } catch {
    return messages;
  }

  if (response.error) {
    return messages;
  }

  const displayNames = new Map(
    (response.data ?? []).map((profile) => [profile.id, profile.display_name])
  );

  return messages.map((message) => ({
    ...message,
    senderDisplayName: displayNames.get(message.sender_id) ?? null,
  }));
}

export async function toClientChatMessagesWithSenders(
  messages: MessageResponseRow[]
): Promise<ClientChatMessage[]> {
  const context = await getLocalFallbackContext();
  const namedMessages = context
    ? await addSenderDisplayNames(context, messages)
    : messages;

  return namedMessages.map(toClientChatMessage);
}

export async function sendMessageViaLocalRpc(
  values: SendMessageInput
): Promise<ChatOperationResult<ClientChatMessage>> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { ok: false, notice: sendNotice };
  }

  const { data, error } = await context.client.rpc("send_chat_message", {
    p_conversation_id: values.conversationId,
    p_body: values.body,
    p_client_request_id: values.clientRequestId,
    p_reply_to_message_id: values.replyToMessageId ?? null,
  });

  if (error || !data) {
    return { ok: false, notice: mapChatErrorNotice(error, sendNotice) };
  }

  return { ok: true, data: toClientChatMessage(data as MessageResponseRow) };
}

export async function commandMessageViaLocalRpc(
  command: ChatMessageCommand
): Promise<ChatOperationResult<ClientChatMessage>> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { ok: false, notice: saveNotice };
  }

  const rpcCall =
    command.kind === "edit"
      ? context.client.rpc("edit_chat_message", {
          p_message_id: command.messageId,
          p_body: command.body,
        })
      : command.kind === "delete"
        ? context.client.rpc("delete_chat_message", {
            p_message_id: command.messageId,
          })
        : context.client.rpc("toggle_message_reaction", {
            p_message_id: command.messageId,
            p_emoji: command.emoji,
          });

  const { data, error } = await rpcCall;

  if (error || !data) {
    return { ok: false, notice: mapChatErrorNotice(error, saveNotice) };
  }

  const [message] = await addReactionAggregates(context, [
    data as MessageResponseRow,
  ]);

  return { ok: true, data: toClientChatMessage(message) };
}

export async function markReadStateViaLocalRpc(
  values: MarkReadStateInput
): Promise<ChatOperationResult<ClientChatReadState>> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { ok: false, notice: sendNotice };
  }

  const { data, error } = await context.client.rpc("mark_chat_read_state", {
    p_conversation_id: values.conversationId,
    p_last_delivered_message_id: values.lastDeliveredMessageId,
    p_last_read_message_id: values.lastReadMessageId,
  });

  if (error || !data) {
    return { ok: false, notice: mapChatErrorNotice(error, sendNotice) };
  }

  return { ok: true, data: toClientReadState(data as ReadStateResponseRow) };
}

export async function refreshMessagesViaLocalRpc(
  values: RefreshMessagesInput
): Promise<ChatOperationResult<ClientChatMessage[]>> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { ok: false, notice: sendNotice };
  }

  const ids = Array.from(new Set(values.messageIds));
  const { data, error } = await context.client
    .from("messages")
    .select("*")
    .in("id", ids);

  if (error || !data) {
    return { ok: false, notice: mapChatErrorNotice(error, sendNotice) };
  }

  const messages = await addReactionAggregates(
    context,
    data as MessageResponseRow[]
  );
  const messagesWithSenders = await addSenderDisplayNames(context, messages);

  return { ok: true, data: messagesWithSenders.map(toClientChatMessage) };
}

export async function refreshConversationViaLocalRpc(
  values: ConversationInput
): Promise<
  ChatOperationResult<{
    messages: ClientChatMessage[];
    readStates: ClientChatReadState[];
  }>
> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { ok: false, notice: sendNotice };
  }

  const { data: messageRows, error: messageError } = await context.client
    .from("messages")
    .select("*")
    .eq("conversation_id", values.conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (messageError || !messageRows) {
    return { ok: false, notice: mapChatErrorNotice(messageError, sendNotice) };
  }

  const { data: readRows, error: readError } = await context.client
    .from("message_reads")
    .select("*")
    .eq("conversation_id", values.conversationId);

  if (readError || !readRows) {
    return { ok: false, notice: mapChatErrorNotice(readError, sendNotice) };
  }

  const messages = await addReactionAggregates(
    context,
    messageRows as MessageResponseRow[]
  );
  const messagesWithSenders = await addSenderDisplayNames(context, messages);

  return {
    ok: true,
    data: {
    messages: messagesWithSenders.map(toClientChatMessage),
    readStates: (readRows as ReadStateResponseRow[]).map(toClientReadState),
    },
  };
}

export async function loadOlderMessagesViaLocalRpc(
  values: LoadOlderMessagesInput
): Promise<
  ChatOperationResult<{
    messages: ClientChatMessage[];
    hasMoreOlder: boolean;
  }>
> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { ok: false, notice: sendNotice };
  }

  const size = Math.min(values.limit ?? chatOlderPageSize, 100);
  const cursor = values.cursor ?? null;

  let query = context.client
    .from("messages")
    .select("*")
    .eq("conversation_id", values.conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(size + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;

  if (error || !data) {
    return { ok: false, notice: mapChatErrorNotice(error, sendNotice) };
  }

  const rows = data as MessageResponseRow[];
  const hasMoreOlder = rows.length > size;
  // Newest-first from the query above; bound to the page then reverse back
  // to the ascending order the reducer/UI expect.
  const windowRows = rows.slice(0, size).reverse();

  const enriched = await addReactionAggregates(context, windowRows);
  const withSenders = await addSenderDisplayNames(context, enriched);

  return {
    ok: true,
    data: { messages: withSenders.map(toClientChatMessage), hasMoreOlder },
  };
}

export async function backfillMessagesViaLocalRpc(
  values: BackfillMessagesInput
): Promise<
  ChatOperationResult<{
    messages: ClientChatMessage[];
    needsReset: boolean;
  }>
> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { ok: false, notice: sendNotice };
  }

  const size = Math.min(values.limit ?? chatOlderPageSize, 100);

  const { data, error } = await context.client
    .from("messages")
    .select("*")
    .eq("conversation_id", values.conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .or(
      `created_at.gt.${values.afterCreatedAt},and(created_at.eq.${values.afterCreatedAt},id.gt.${values.afterMessageId})`
    )
    .limit(size + 1);

  if (error || !data) {
    return { ok: false, notice: mapChatErrorNotice(error, sendNotice) };
  }

  const rows = data as MessageResponseRow[];
  // Gap exceeds the bound: the caller should discard this partial page and
  // reset to the newest window (loadNewestMessagesAction) instead of
  // stitching a too-large catch-up in.
  const needsReset = rows.length > size;

  const enriched = await addReactionAggregates(context, rows);
  const withSenders = await addSenderDisplayNames(context, enriched);

  return {
    ok: true,
    data: { messages: withSenders.map(toClientChatMessage), needsReset },
  };
}

export async function loadNewestMessagesViaLocalRpc(
  values: LoadNewestMessagesInput
): Promise<
  ChatOperationResult<{
    messages: ClientChatMessage[];
    readStates: ClientChatReadState[];
    hasMoreOlder: boolean;
    oldestCursor: { createdAt: string; id: string } | null;
  }>
> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { ok: false, notice: sendNotice };
  }

  const size = Math.min(values.limit ?? chatOlderPageSize, 100);

  const { data: messageRows, error: messageError } = await context.client
    .from("messages")
    .select("*")
    .eq("conversation_id", values.conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(size + 1);

  if (messageError || !messageRows) {
    return { ok: false, notice: mapChatErrorNotice(messageError, sendNotice) };
  }

  const { data: readRows, error: readError } = await context.client
    .from("message_reads")
    .select("*")
    .eq("conversation_id", values.conversationId);

  if (readError || !readRows) {
    return { ok: false, notice: mapChatErrorNotice(readError, sendNotice) };
  }

  const rows = messageRows as MessageResponseRow[];
  const hasMoreOlder = rows.length > size;
  const windowRows = rows.slice(0, size).reverse();
  const oldestCursor =
    windowRows.length > 0
      ? { createdAt: windowRows[0].created_at, id: windowRows[0].id }
      : null;

  const enriched = await addReactionAggregates(context, windowRows);
  const withSenders = await addSenderDisplayNames(context, enriched);

  return {
    ok: true,
    data: {
      messages: withSenders.map(toClientChatMessage),
      readStates: (readRows as ReadStateResponseRow[]).map(toClientReadState),
      hasMoreOlder,
      oldestCursor,
    },
  };
}
