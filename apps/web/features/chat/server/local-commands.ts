import type { ClientChatMessage, ClientChatReadState } from "@/lib/services";
import type {
  MarkReadStateActionState,
  SendMessageActionState,
} from "@/features/chat/contracts";
import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import {
  chatOlderPageSize,
  reactionPageSize,
  saveNotice,
  sendNotice,
} from "./constants";
import { mapChatErrorNotice } from "./edge-transport";
import {
  toClientChatMessage,
  toClientReadState,
  type ChatCommand,
  type MessageResponseRow,
  type ReadStateResponseRow,
} from "./response-mapping";
import {
  backfillMessagesSchema,
  loadNewestMessagesSchema,
  loadOlderMessagesSchema,
  markReadStateSchema,
  refreshConversationSchema,
  refreshMessagesSchema,
  sendMessageSchema,
} from "./schemas";
import { z } from "zod";

async function getLocalFallbackContext(): Promise<{
  services: Awaited<ReturnType<typeof createServerSupabaseServices>>;
  userId: string;
} | null> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return null;
  }

  return { services, userId: userResult.data.id };
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
      const { data, error } = await context.services.client
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
    response = await context.services.client
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
  values: z.infer<typeof sendMessageSchema>
): Promise<SendMessageActionState> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { status: "notice", values, notice: sendNotice };
  }

  const { data, error } = await context.services.client.rpc("send_chat_message", {
    p_conversation_id: values.conversationId,
    p_body: values.body,
    p_client_request_id: values.clientRequestId,
    p_reply_to_message_id: values.replyToMessageId ?? null,
  });

  if (error || !data) {
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(error, sendNotice),
    };
  }

  return {
    status: "sent",
    values,
    message: toClientChatMessage(data as MessageResponseRow),
  };
}

export async function commandMessageViaLocalRpc(
  values: unknown,
  command: ChatCommand
): Promise<SendMessageActionState> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { status: "notice", values, notice: saveNotice };
  }

  const rpcCall =
    command.action === "edit-message"
      ? context.services.client.rpc("edit_chat_message", {
          p_message_id: command.messageId,
          p_body: command.body,
        })
      : command.action === "delete-message"
        ? context.services.client.rpc("delete_chat_message", {
            p_message_id: command.messageId,
          })
        : context.services.client.rpc("toggle_message_reaction", {
            p_message_id: command.messageId,
            p_emoji: command.emoji,
          });

  const { data, error } = await rpcCall;

  if (error || !data) {
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(error, saveNotice),
    };
  }

  const [message] = await addReactionAggregates(context, [
    data as MessageResponseRow,
  ]);

  return {
    status: "sent",
    values,
    message: toClientChatMessage(message),
  };
}

export async function markReadStateViaLocalRpc(
  values: z.infer<typeof markReadStateSchema>
): Promise<MarkReadStateActionState> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { status: "notice", values, notice: sendNotice };
  }

  const { data, error } = await context.services.client.rpc("mark_chat_read_state", {
    p_conversation_id: values.conversationId,
    p_last_delivered_message_id: values.lastDeliveredMessageId,
    p_last_read_message_id: values.lastReadMessageId,
  });

  if (error || !data) {
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(error, sendNotice),
    };
  }

  return {
    status: "sent",
    values,
    readState: toClientReadState(data as ReadStateResponseRow),
  };
}

export async function refreshMessagesViaLocalRpc(
  values: z.infer<typeof refreshMessagesSchema>
): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
}> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { status: "notice", values, notice: sendNotice };
  }

  const ids = Array.from(new Set(values.messageIds));
  const { data, error } = await context.services.client
    .from("messages")
    .select("*")
    .in("id", ids);

  if (error || !data) {
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(error, sendNotice),
    };
  }

  const messages = await addReactionAggregates(
    context,
    data as MessageResponseRow[]
  );
  const messagesWithSenders = await addSenderDisplayNames(context, messages);

  return {
    status: "sent",
    values,
    messages: messagesWithSenders.map(toClientChatMessage),
  };
}

export async function refreshConversationViaLocalRpc(
  values: z.infer<typeof refreshConversationSchema>
): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  readStates?: ClientChatReadState[];
}> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { status: "notice", values, notice: sendNotice };
  }

  const { data: messageRows, error: messageError } = await context.services.client
    .from("messages")
    .select("*")
    .eq("conversation_id", values.conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (messageError || !messageRows) {
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(messageError, sendNotice),
    };
  }

  const { data: readRows, error: readError } = await context.services.client
    .from("message_reads")
    .select("*")
    .eq("conversation_id", values.conversationId);

  if (readError || !readRows) {
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(readError, sendNotice),
    };
  }

  const messages = await addReactionAggregates(
    context,
    messageRows as MessageResponseRow[]
  );
  const messagesWithSenders = await addSenderDisplayNames(context, messages);

  return {
    status: "sent",
    values,
    messages: messagesWithSenders.map(toClientChatMessage),
    readStates: (readRows as ReadStateResponseRow[]).map(toClientReadState),
  };
}

export async function loadOlderMessagesViaLocalRpc(
  values: z.infer<typeof loadOlderMessagesSchema>
): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  hasMoreOlder?: boolean;
}> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { status: "notice", values, notice: sendNotice };
  }

  const size = Math.min(values.limit ?? chatOlderPageSize, 100);
  const cursor = values.cursor ?? null;

  let query = context.services.client
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
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(error, sendNotice),
    };
  }

  const rows = data as MessageResponseRow[];
  const hasMoreOlder = rows.length > size;
  // Newest-first from the query above; bound to the page then reverse back
  // to the ascending order the reducer/UI expect.
  const windowRows = rows.slice(0, size).reverse();

  const enriched = await addReactionAggregates(context, windowRows);
  const withSenders = await addSenderDisplayNames(context, enriched);

  return {
    status: "sent",
    values,
    messages: withSenders.map(toClientChatMessage),
    hasMoreOlder,
  };
}

export async function backfillMessagesViaLocalRpc(
  values: z.infer<typeof backfillMessagesSchema>
): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  needsReset?: boolean;
}> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { status: "notice", values, notice: sendNotice };
  }

  const size = Math.min(values.limit ?? chatOlderPageSize, 100);

  const { data, error } = await context.services.client
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
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(error, sendNotice),
    };
  }

  const rows = data as MessageResponseRow[];
  // Gap exceeds the bound: the caller should discard this partial page and
  // reset to the newest window (loadNewestMessagesAction) instead of
  // stitching a too-large catch-up in.
  const needsReset = rows.length > size;

  const enriched = await addReactionAggregates(context, rows);
  const withSenders = await addSenderDisplayNames(context, enriched);

  return {
    status: "sent",
    values,
    messages: withSenders.map(toClientChatMessage),
    needsReset,
  };
}

export async function loadNewestMessagesViaLocalRpc(
  values: z.infer<typeof loadNewestMessagesSchema>
): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  readStates?: ClientChatReadState[];
  hasMoreOlder?: boolean;
  oldestCursor?: { createdAt: string; id: string } | null;
}> {
  const context = await getLocalFallbackContext();
  if (!context) {
    return { status: "notice", values, notice: sendNotice };
  }

  const size = Math.min(values.limit ?? chatOlderPageSize, 100);

  const { data: messageRows, error: messageError } = await context.services.client
    .from("messages")
    .select("*")
    .eq("conversation_id", values.conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(size + 1);

  if (messageError || !messageRows) {
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(messageError, sendNotice),
    };
  }

  const { data: readRows, error: readError } = await context.services.client
    .from("message_reads")
    .select("*")
    .eq("conversation_id", values.conversationId);

  if (readError || !readRows) {
    return {
      status: "notice",
      values,
      notice: mapChatErrorNotice(readError, sendNotice),
    };
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
    status: "sent",
    values,
    messages: withSenders.map(toClientChatMessage),
    readStates: (readRows as ReadStateResponseRow[]).map(toClientReadState),
    hasMoreOlder,
    oldestCursor,
  };
}
