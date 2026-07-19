"use server";

import { getServerServices } from "@/lib/services/runtime/server";
import type {
  ChatSearchActionState,
  MarkReadStateActionState,
  MessagePopoverActionState,
  SendMessageActionState,
  ReportGifActionState,
  UnreadSummaryActionState,
} from "@/features/chat/contracts";
import type {
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";
import { createChatActionHandlers } from "./action-handlers";
import { searchChatMessagesSchema, unreadSummarySchema } from "./schemas";
import { getDirectConversationPreviews } from "./page-data";

export type * from "@/features/chat/contracts";

async function handlers() {
  const { chatCommands } = await getServerServices();
  return createChatActionHandlers(chatCommands);
}

export async function searchChatMessagesAction(
  input: unknown
): Promise<ChatSearchActionState> {
  const parsed = searchChatMessagesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "notice",
      values: input,
      notice: "Those filters need a quick check before searching.",
    };
  }

  const { database } = await getServerServices();
  const result = await database.chatSearch.search(parsed.data);
  return result.ok
    ? {
        status: "sent",
        values: parsed.data,
        messages: result.data.messages,
        nextCursor: result.data.nextCursor,
        totalCount: result.data.totalCount,
      }
    : {
        status: "notice",
        values: parsed.data,
        notice: result.notice,
      };
}

export async function sendMessageAction(
  input: unknown
): Promise<SendMessageActionState> {
  return (await handlers()).sendMessage(input);
}

export async function editMessageAction(
  input: unknown
): Promise<SendMessageActionState> {
  return (await handlers()).editMessage(input);
}

export async function deleteMessageAction(
  input: unknown
): Promise<SendMessageActionState> {
  return (await handlers()).deleteMessage(input);
}

export async function setReactionAction(
  input: unknown
): Promise<SendMessageActionState> {
  return (await handlers()).setReaction(input);
}

export async function reportGifAction(
  input: unknown
): Promise<ReportGifActionState> {
  return (await handlers()).reportGif(input);
}

export async function markReadStateAction(
  input: unknown
): Promise<MarkReadStateActionState> {
  return (await handlers()).markReadState(input);
}

export async function refreshUnreadSummaryAction(
  input: unknown
): Promise<UnreadSummaryActionState> {
  const parsed = unreadSummarySchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "notice",
      values: input,
      notice: "That conversation is not available.",
    };
  }

  const { database } = await getServerServices();
  const result = await database.chat.getUnreadSummary(parsed.data.conversationId);
  return result.ok
    ? {
        status: "sent",
        values: parsed.data,
        unreadSummary: result.data,
      }
    : {
        status: "notice",
        values: parsed.data,
        notice: "Unread messages are still catching up.",
      };
}

export async function loadMessagePopoverAction(
  input: unknown
): Promise<MessagePopoverActionState> {
  try {
    const previews = await getDirectConversationPreviews();
    return {
      status: "sent",
      values: input,
      previews,
    };
  } catch {
    return {
      status: "notice",
      values: input,
      notice: "Messages are still catching up.",
    };
  }
}

export async function refreshMessagesAction(input: unknown): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
}> {
  return (await handlers()).refreshMessages(input);
}

export async function refreshConversationAction(input: unknown): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  readStates?: ClientChatReadState[];
}> {
  return (await handlers()).refreshConversation(input);
}

export async function loadOlderMessagesAction(input: unknown): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  hasMoreOlder?: boolean;
}> {
  return (await handlers()).loadOlderMessages(input);
}

export async function backfillMessagesAction(input: unknown): Promise<{
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
  needsReset?: boolean;
}> {
  return (await handlers()).backfillMessages(input);
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
  return (await handlers()).loadNewestMessages(input);
}
