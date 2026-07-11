"use server";

import type { ClientChatMessage, ClientChatReadState } from "@/lib/services";
import type {
  MarkReadStateActionState,
  SendMessageActionState,
} from "@/features/chat/contracts";
import {
  backfillMessagesSchema,
  deleteMessageSchema,
  editMessageSchema,
  loadNewestMessagesSchema,
  loadOlderMessagesSchema,
  markReadStateSchema,
  refreshConversationSchema,
  refreshMessagesSchema,
  sendMessageSchema,
  toggleReactionSchema,
} from "./schemas";
import {
  toClientChatMessage,
  toClientReadState,
  type ChatCommand,
  type MessageResponseRow,
  type ReadStateResponseRow,
} from "./response-mapping";
import {
  getAccessToken,
  isLocalEdgeUnavailable,
  postEdgeFunction,
} from "./edge-transport";
import { sendNotice } from "./constants";
import {
  backfillMessagesViaLocalRpc,
  commandMessageViaLocalRpc,
  loadNewestMessagesViaLocalRpc,
  loadOlderMessagesViaLocalRpc,
  markReadStateViaLocalRpc,
  refreshConversationViaLocalRpc,
  refreshMessagesViaLocalRpc,
  sendMessageViaLocalRpc,
  toClientChatMessagesWithSenders,
} from "./local-commands";
import { chatLimits } from "@fish/core/chat";

export type {
  MarkReadStateActionState,
  SendMessageActionState,
} from "@/features/chat/contracts";





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

// The three actions below are reads (pagination/backfill/reset), so — per the
// AGENTS.md API boundary — they go straight to a direct RLS-protected select
// and never post to the write-oriented chat-command Edge Function.

export async function loadOlderMessagesAction(input: unknown): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  hasMoreOlder?: boolean;
}> {
  const parsed = loadOlderMessagesSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: sendNotice };
  }

  return loadOlderMessagesViaLocalRpc(parsed.data);
}

export async function backfillMessagesAction(input: unknown): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  needsReset?: boolean;
}> {
  const parsed = backfillMessagesSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: sendNotice };
  }

  return backfillMessagesViaLocalRpc(parsed.data);
}

export async function loadNewestMessagesAction(input: unknown): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  readStates?: ClientChatReadState[];
  hasMoreOlder?: boolean;
  oldestCursor?: { createdAt: string; id: string } | null;
}> {
  const parsed = loadNewestMessagesSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "notice", values: input, notice: sendNotice };
  }

  return loadNewestMessagesViaLocalRpc(parsed.data);
}
