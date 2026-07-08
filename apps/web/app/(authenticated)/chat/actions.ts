"use server";

import type { ClientChatMessage, ClientChatReadState } from "@/lib/services";
import { getPublicEnv } from "@/lib/services/env";
import { createServerSupabaseServices } from "@/lib/services/supabase/server";
import { chatLimits } from "@fish/core/chat";
import { z } from "zod";

const sendNotice = "That did not send yet. Keep this open and try again.";
const saveNotice = "That did not save yet. Keep this open and try again.";
const localEdgeTimeoutMs = 1_500;

const sendMessageSchema = z.strictObject({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(chatLimits.messageBodyMaxLength),
  clientRequestId: z.string().trim().min(1).max(120),
  replyToMessageId: z.string().trim().min(1).nullable().optional(),
});

const editMessageSchema = z.strictObject({
  messageId: z.string().trim().min(1),
  body: z.string().trim().min(1).max(chatLimits.messageBodyMaxLength),
});

const deleteMessageSchema = z.strictObject({
  messageId: z.string().trim().min(1),
});

const toggleReactionSchema = z.strictObject({
  messageId: z.string().trim().min(1),
  emoji: z.string().trim().min(1).max(16),
});

const markReadStateSchema = z.strictObject({
  conversationId: z.string().uuid(),
  lastDeliveredMessageId: z.string().trim().min(1).nullable(),
  lastReadMessageId: z.string().trim().min(1).nullable(),
});

const refreshMessagesSchema = z.strictObject({
  messageIds: z.array(z.string().trim().min(1)).min(1).max(50),
});

const refreshConversationSchema = z.strictObject({
  conversationId: z.string().uuid(),
});

type MessageResponseRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "client" | "coach";
  sender_display_name?: string | null;
  senderDisplayName?: string | null;
  body: string;
  client_request_id: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_message_id?: string | null;
  reactions?: Array<{
    emoji: string;
    count: number;
    by_me?: boolean;
    byMe?: boolean;
  }>;
};

type ReadStateResponseRow = {
  user_id: string;
  last_delivered_message_id: string | null;
  delivered_at: string | null;
  last_read_message_id: string | null;
  read_at: string | null;
};

type ChatCommand =
  | {
      action: "edit-message";
      messageId: string;
      body: string;
    }
  | {
      action: "delete-message";
      messageId: string;
    }
  | {
      action: "toggle-reaction";
      messageId: string;
      emoji: string;
    };

export interface SendMessageActionState {
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  message?: ClientChatMessage;
}

export interface MarkReadStateActionState {
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  readState?: {
    userId: string;
    lastDeliveredMessageId: string | null;
    deliveredAt: string | null;
    lastReadMessageId: string | null;
    readAt: string | null;
  };
}

function toClientChatMessage(row: MessageResponseRow): ClientChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    senderDisplayName: row.senderDisplayName ?? row.sender_display_name ?? null,
    body: row.body,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at ?? null,
    replyToMessageId: row.reply_to_message_id ?? null,
    reactions: (row.reactions ?? []).map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
      byMe: reaction.byMe ?? reaction.by_me ?? false,
    })),
  };
}

function toClientReadState(row: ReadStateResponseRow): ClientChatReadState {
  return {
    userId: row.user_id,
    lastDeliveredMessageId: row.last_delivered_message_id,
    deliveredAt: row.delivered_at,
    lastReadMessageId: row.last_read_message_id,
    readAt: row.read_at,
  };
}

async function getAccessToken(): Promise<string | null> {
  const services = await createServerSupabaseServices();
  const userResult = await services.auth.getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    return null;
  }

  const { data: sessionData, error: sessionError } =
    await services.client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return null;
  }

  return accessToken;
}

async function postEdgeFunction(
  functionName: "send-message" | "chat-command",
  accessToken: string,
  body: unknown
): Promise<Response> {
  const controller = new AbortController();
  const timeout = isLocalSupabaseUrl()
    ? setTimeout(() => controller.abort(), localEdgeTimeoutMs)
    : null;

  try {
    return await fetch(`${getPublicEnv().supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function isLocalSupabaseUrl(): boolean {
  try {
    const hostname = new URL(getPublicEnv().supabaseUrl).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

function isLocalEdgeUnavailable(response: Response | null): boolean {
  return (
    isLocalSupabaseUrl() &&
    (!response || [404, 502, 503, 504].includes(response.status))
  );
}

function mapChatErrorNotice(
  error: { message?: string } | null | undefined,
  fallback = sendNotice
): string {
  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("conversation not found")) {
    return "That conversation is not available.";
  }

  if (message.includes("conflicts")) {
    return "That send is already in progress. Try once more.";
  }

  if (message.includes("reply target") || message.includes("message not found")) {
    return "That message is no longer available.";
  }

  if (message.includes("reaction")) {
    return "That reaction is not available.";
  }

  if (message.includes("too long")) {
    return "This message is a little long. Try sending it in two parts.";
  }

  if (message.includes("required")) {
    return "Add a message before sending.";
  }

  return fallback;
}

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

  const { data, error } = await context.services.client
    .from("message_reactions")
    .select("message_id, emoji, user_id")
    .in("message_id", ids)
    .is("removed_at", null);

  if (error) {
    return messages.map((message) => ({ ...message, reactions: [] }));
  }

  const reactionsByMessage = aggregateReactions(
    (data ?? []).map((row) => ({
      message_id: row.message_id,
      emoji: row.emoji,
      user_id: row.user_id,
    })),
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

async function toClientChatMessagesWithSenders(
  messages: MessageResponseRow[]
): Promise<ClientChatMessage[]> {
  const context = await getLocalFallbackContext();
  const namedMessages = context
    ? await addSenderDisplayNames(context, messages)
    : messages;

  return namedMessages.map(toClientChatMessage);
}

async function sendMessageViaLocalRpc(
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

async function commandMessageViaLocalRpc(
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

async function markReadStateViaLocalRpc(
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

async function refreshMessagesViaLocalRpc(
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

async function refreshConversationViaLocalRpc(
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

export async function sendMessageAction(
  input: unknown
): Promise<SendMessageActionState> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "notice",
      values: input,
      notice:
        typeof input === "object" &&
        input !== null &&
        "body" in input &&
        String((input as { body?: unknown }).body ?? "").length >
          chatLimits.messageBodyMaxLength
          ? "This message is a little long. Try sending it in two parts."
          : "Add a message before sending.",
    };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: "notice", values: parsed.data, notice: sendNotice };
  }

  const response = await postEdgeFunction(
    "send-message",
    accessToken,
    parsed.data.replyToMessageId
      ? parsed.data
      : {
          conversationId: parsed.data.conversationId,
          body: parsed.data.body,
          clientRequestId: parsed.data.clientRequestId,
        }
  ).catch(() => null);

  if (!response) {
    return sendMessageViaLocalRpc(parsed.data);
  }

  if (isLocalEdgeUnavailable(response)) {
    return sendMessageViaLocalRpc(parsed.data);
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: MessageResponseRow | MessageResponseRow[] }
    | null;

  if (!response.ok) {
    return {
      status: "notice",
      values: parsed.data,
      notice: payload?.error ?? sendNotice,
    };
  }

  const message = Array.isArray(payload?.message)
    ? payload?.message[0]
    : payload?.message;

  if (!message) {
    return { status: "notice", values: parsed.data, notice: sendNotice };
  }

  return {
    status: "sent",
    values: parsed.data,
    message: toClientChatMessage(message),
  };
}

async function commandMessageAction(
  values: unknown,
  command: ChatCommand
): Promise<SendMessageActionState> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: "notice", values, notice: sendNotice };
  }

  const response = await postEdgeFunction("chat-command", accessToken, command).catch(
    () => null
  );
  if (!response) {
    return commandMessageViaLocalRpc(values, command);
  }

  if (isLocalEdgeUnavailable(response)) {
    return commandMessageViaLocalRpc(values, command);
  }
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: MessageResponseRow | MessageResponseRow[] }
    | null;

  if (!response.ok) {
    return {
      status: "notice",
      values,
      notice: payload?.error ?? sendNotice,
    };
  }

  const message = Array.isArray(payload?.message)
    ? payload?.message[0]
    : payload?.message;

  if (!message) {
    return { status: "notice", values, notice: sendNotice };
  }

  return {
    status: "sent",
    values,
    message: toClientChatMessage(message),
  };
}

export async function editMessageAction(
  input: unknown
): Promise<SendMessageActionState> {
  const parsed = editMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "notice",
      values: input,
      notice:
        typeof input === "object" &&
        input !== null &&
        "body" in input &&
        String((input as { body?: unknown }).body ?? "").length >
          chatLimits.messageBodyMaxLength
          ? "This message is a little long. Try sending it in two parts."
          : "Add a message before saving.",
    };
  }

  return commandMessageAction(parsed.data, {
    action: "edit-message",
    messageId: parsed.data.messageId,
    body: parsed.data.body,
  });
}

export async function deleteMessageAction(
  input: unknown
): Promise<SendMessageActionState> {
  const parsed = deleteMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: sendNotice };
  }

  return commandMessageAction(parsed.data, {
    action: "delete-message",
    messageId: parsed.data.messageId,
  });
}

export async function toggleReactionAction(
  input: unknown
): Promise<SendMessageActionState> {
  const parsed = toggleReactionSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: sendNotice };
  }

  return commandMessageAction(parsed.data, {
    action: "toggle-reaction",
    messageId: parsed.data.messageId,
    emoji: parsed.data.emoji,
  });
}

export async function markReadStateAction(
  input: unknown
): Promise<MarkReadStateActionState> {
  const parsed = markReadStateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: sendNotice };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: "notice", values: parsed.data, notice: sendNotice };
  }

  const response = await postEdgeFunction("chat-command", accessToken, {
    action: "mark-read-state",
    conversationId: parsed.data.conversationId,
    lastDeliveredMessageId: parsed.data.lastDeliveredMessageId,
    lastReadMessageId: parsed.data.lastReadMessageId,
  }).catch(() => null);
  if (!response) {
    return markReadStateViaLocalRpc(parsed.data);
  }

  if (isLocalEdgeUnavailable(response)) {
    return markReadStateViaLocalRpc(parsed.data);
  }
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; readState?: ReadStateResponseRow }
    | null;

  if (!response.ok || !payload?.readState) {
    return {
      status: "notice",
      values: parsed.data,
      notice: payload?.error ?? sendNotice,
    };
  }

  return {
    status: "sent",
    values: parsed.data,
    readState: toClientReadState(payload.readState),
  };
}

export async function refreshMessagesAction(
  input: unknown
): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
}> {
  const parsed = refreshMessagesSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: sendNotice };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: "notice", values: parsed.data, notice: sendNotice };
  }

  const response = await postEdgeFunction("chat-command", accessToken, {
    action: "refresh-messages",
    messageIds: Array.from(new Set(parsed.data.messageIds)),
  }).catch(() => null);
  if (!response) {
    return refreshMessagesViaLocalRpc(parsed.data);
  }

  if (isLocalEdgeUnavailable(response)) {
    return refreshMessagesViaLocalRpc(parsed.data);
  }
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; messages?: MessageResponseRow[] }
    | null;

  if (!response.ok || !payload?.messages) {
    return {
      status: "notice",
      values: parsed.data,
      notice: payload?.error ?? sendNotice,
    };
  }

  return {
    status: "sent",
    values: parsed.data,
    messages: await toClientChatMessagesWithSenders(payload.messages),
  };
}

export async function refreshConversationAction(
  input: unknown
): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  readStates?: ClientChatReadState[];
}> {
  const parsed = refreshConversationSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: sendNotice };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: "notice", values: parsed.data, notice: sendNotice };
  }

  const response = await postEdgeFunction("chat-command", accessToken, {
    action: "refresh-conversation",
    conversationId: parsed.data.conversationId,
  }).catch(() => null);
  if (!response) {
    return refreshConversationViaLocalRpc(parsed.data);
  }

  if (isLocalEdgeUnavailable(response)) {
    return refreshConversationViaLocalRpc(parsed.data);
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: string;
        messages?: MessageResponseRow[];
        readStates?: ReadStateResponseRow[];
      }
    | null;

  if (!response.ok || !payload?.messages || !payload?.readStates) {
    return {
      status: "notice",
      values: parsed.data,
      notice: payload?.error ?? sendNotice,
    };
  }

  return {
    status: "sent",
    values: parsed.data,
    messages: await toClientChatMessagesWithSenders(payload.messages),
    readStates: payload.readStates.map(toClientReadState),
  };
}
