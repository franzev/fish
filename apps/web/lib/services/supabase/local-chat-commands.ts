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
  ReportGifInput,
  SendMessageInput,
} from "../contracts";
import type { Json } from "@fish/supabase";
import { createServerSupabaseClient } from "./server";
import type { AppSupabaseClient } from "./types";
import {
  chatOlderPageSize,
  mapChatErrorNotice,
  type MessageResponseRow,
  type ReadStateResponseRow,
  saveNotice,
  sendNotice,
  toClientChatMessage,
  toClientReadState,
} from "./chat-mapping";
import { loadSenderDisplayNames } from "./chat-sender-profiles";
import {
  fetchAttachmentUrls,
  fetchReactionsFor,
  indexAttachments,
} from "./chat-enrichment";

export async function getLocalFallbackContext(
  providedClient?: AppSupabaseClient
): Promise<{
  client: AppSupabaseClient;
  userId: string;
} | null> {
  const client = providedClient ?? await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return { client, userId: data.user.id };
}

export type LocalChatCommandContext = NonNullable<
  Awaited<ReturnType<typeof getLocalFallbackContext>>
>;

export async function reportGifViaLocalRpc(
  values: ReportGifInput,
  contextOverride?: LocalChatCommandContext | null
): Promise<ChatOperationResult<void>> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
  if (!context) return { ok: false, notice: saveNotice };
  const { data, error } = await context.client.rpc("report_message_gif", {
    p_message_id: values.messageId,
  });
  return error || !data
    ? { ok: false, notice: "That report did not send yet. Try again." }
    : { ok: true, data: undefined };
}

async function addReactionAggregates(
  context: NonNullable<Awaited<ReturnType<typeof getLocalFallbackContext>>>,
  messages: MessageResponseRow[]
): Promise<MessageResponseRow[]> {
  const ids = messages.map((message) => message.id);
  if (ids.length === 0) {
    return messages;
  }

  let reactionsByMessage: Awaited<ReturnType<typeof fetchReactionsFor>>;
  try {
    reactionsByMessage = await fetchReactionsFor(context.client, ids);
  } catch {
    return messages.map((message) => ({ ...message, reactions: [] }));
  }

  return messages.map((message) => ({
    ...message,
    reactions: reactionsByMessage.get(message.id) ?? [],
  }));
}

async function addSenderDisplayNames(
  context: NonNullable<Awaited<ReturnType<typeof getLocalFallbackContext>>>,
  messages: MessageResponseRow[]
): Promise<MessageResponseRow[]> {
  const displayNames = await loadSenderDisplayNames(context.client, messages);

  return messages.map((message) => ({
    ...message,
    senderDisplayName: displayNames.get(message.sender_id) ?? null,
  }));
}

async function addImageAttachments(
  context: NonNullable<Awaited<ReturnType<typeof getLocalFallbackContext>>>,
  messages: MessageResponseRow[]
): Promise<MessageResponseRow[]> {
  const messageIds = messages.map((message) => message.id);
  if (messageIds.length === 0) return messages;

  let response;
  try {
    response = await context.client
      .from("message_attachments")
      .select("id, message_id, kind, original_name, stored_mime_type, stored_byte_size, width, height, thumbnail_path, display_path, position, status")
      .in("message_id", messageIds)
      .eq("status", "ready")
      .order("position", { ascending: true });
  } catch {
    return messages.map((message) => ({ ...message, images: [] }));
  }
  const { data, error } = response;
  if (error || !data) return messages.map((message) => ({ ...message, images: [] }));

  const attachmentRows = (data as unknown as Array<{
    id: string;
    message_id: string;
    status: "ready";
    kind: "image" | "file";
    original_name: string;
    stored_mime_type: string | null;
    stored_byte_size: number | null;
    width: number | null;
    height: number | null;
    thumbnail_path: string | null;
    display_path: string | null;
  }>).filter((image) => image.message_id && image.display_path);
  let byMessage: Map<string, NonNullable<MessageResponseRow["images"]>>;
  try {
    const urls = await fetchAttachmentUrls(context.client, attachmentRows);
    byMessage = indexAttachments(attachmentRows, urls);
  } catch {
    byMessage = new Map();
  }
  return messages.map((message) => ({ ...message, images: byMessage.get(message.id) ?? [] }));
}

async function addGifAttachments(
  context: NonNullable<Awaited<ReturnType<typeof getLocalFallbackContext>>>,
  messages: MessageResponseRow[]
): Promise<MessageResponseRow[]> {
  const messageIds = messages.map((message) => message.id);
  if (messageIds.length === 0) return messages;

  let response;
  try {
    response = await context.client
      .from("message_gifs")
      .select("*")
      .in("message_id", messageIds);
  } catch {
    return messages;
  }
  const { data, error } = response;
  if (error || !data) return messages;

  const byMessage = new Map(data.map((gif) => [gif.message_id, gif]));
  return messages.map((message) => ({
    ...message,
    gif: byMessage.get(message.id) as MessageResponseRow["gif"],
  }));
}

export async function toClientChatMessagesWithSenders(
  messages: MessageResponseRow[],
  contextOverride?: LocalChatCommandContext | null
): Promise<ClientChatMessage[]> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
  const namedMessages = context
    ? await addSenderDisplayNames(context, messages)
    : messages;
  const enrichedMessages = context
    ? await addImageAttachments(context, namedMessages)
    : namedMessages;
  const withGifs = context
    ? await addGifAttachments(context, enrichedMessages)
    : enrichedMessages;
  return withGifs.map(toClientChatMessage);
}

export async function sendMessageViaLocalRpc(
  values: SendMessageInput,
  contextOverride?: LocalChatCommandContext | null
): Promise<ChatOperationResult<ClientChatMessage>> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
  if (!context) {
    return { ok: false, notice: sendNotice };
  }

  const { data, error } = await context.client.rpc("send_chat_message", {
    p_conversation_id: values.conversationId,
    p_body: values.body,
    p_client_request_id: values.clientRequestId,
    ...(values.replyToMessageId
      ? { p_reply_to_message_id: values.replyToMessageId }
      : {}),
    ...(values.attachmentIds?.length ? { p_attachment_ids: values.attachmentIds } : {}),
    ...(values.gif ? { p_gif: values.gif as unknown as Json } : {}),
    ...(values.stickerId ? { p_sticker_id: values.stickerId } : {}),
  });

  if (error || !data) {
    return { ok: false, notice: mapChatErrorNotice(error, sendNotice) };
  }

  const [message] = await toClientChatMessagesWithSenders([data as MessageResponseRow], context);
  return { ok: true, data: message };
}

export async function commandMessageViaLocalRpc(
  command: ChatMessageCommand,
  contextOverride?: LocalChatCommandContext | null
): Promise<ChatOperationResult<ClientChatMessage>> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
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
        : context.client.rpc("set_message_reaction", {
            p_message_id: command.messageId,
            p_emoji: command.emoji,
            p_active: command.active,
          });

  const { data, error } = await rpcCall;

  if (error || !data) {
    return { ok: false, notice: mapChatErrorNotice(error, saveNotice) };
  }

  const [message] = await addReactionAggregates(context, [
    data as MessageResponseRow,
  ]);

  const [mapped] = await toClientChatMessagesWithSenders([message], context);
  return { ok: true, data: mapped };
}

export async function markReadStateViaLocalRpc(
  values: MarkReadStateInput,
  contextOverride?: LocalChatCommandContext | null
): Promise<ChatOperationResult<ClientChatReadState>> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
  if (!context) {
    return { ok: false, notice: sendNotice };
  }

  const { data, error } = await context.client.rpc("mark_chat_read_state", {
    p_conversation_id: values.conversationId,
    ...(values.lastDeliveredMessageId
      ? { p_last_delivered_message_id: values.lastDeliveredMessageId }
      : {}),
    ...(values.lastReadMessageId
      ? { p_last_read_message_id: values.lastReadMessageId }
      : {}),
  });

  if (error || !data) {
    return { ok: false, notice: mapChatErrorNotice(error, sendNotice) };
  }

  return { ok: true, data: toClientReadState(data as ReadStateResponseRow) };
}

export async function refreshMessagesViaLocalRpc(
  values: RefreshMessagesInput,
  contextOverride?: LocalChatCommandContext | null
): Promise<ChatOperationResult<ClientChatMessage[]>> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
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

  return { ok: true, data: await toClientChatMessagesWithSenders(messagesWithSenders, context) };
}

export async function refreshConversationViaLocalRpc(
  values: ConversationInput,
  contextOverride?: LocalChatCommandContext | null
): Promise<
  ChatOperationResult<{
    messages: ClientChatMessage[];
    readStates: ClientChatReadState[];
  }>
> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
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
    messages: await toClientChatMessagesWithSenders(messagesWithSenders, context),
    readStates: (readRows as ReadStateResponseRow[]).map(toClientReadState),
    },
  };
}

export async function loadOlderMessagesViaLocalRpc(
  values: LoadOlderMessagesInput,
  contextOverride?: LocalChatCommandContext | null
): Promise<
  ChatOperationResult<{
    messages: ClientChatMessage[];
    hasMoreOlder: boolean;
  }>
> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
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
    data: { messages: await toClientChatMessagesWithSenders(withSenders, context), hasMoreOlder },
  };
}

export async function backfillMessagesViaLocalRpc(
  values: BackfillMessagesInput,
  contextOverride?: LocalChatCommandContext | null
): Promise<
  ChatOperationResult<{
    messages: ClientChatMessage[];
    needsReset: boolean;
  }>
> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
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
    data: { messages: await toClientChatMessagesWithSenders(withSenders, context), needsReset },
  };
}

export async function loadNewestMessagesViaLocalRpc(
  values: LoadNewestMessagesInput,
  contextOverride?: LocalChatCommandContext | null
): Promise<
  ChatOperationResult<{
    messages: ClientChatMessage[];
    readStates: ClientChatReadState[];
    hasMoreOlder: boolean;
    oldestCursor: { createdAt: string; id: string } | null;
  }>
> {
  const context = contextOverride === undefined ? await getLocalFallbackContext() : contextOverride;
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
      messages: await toClientChatMessagesWithSenders(withSenders, context),
      readStates: (readRows as ReadStateResponseRow[]).map(toClientReadState),
      hasMoreOlder,
      oldestCursor,
    },
  };
}
