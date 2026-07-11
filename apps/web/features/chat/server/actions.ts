"use server";

import { getServerServices } from "@/lib/services/runtime/server";
import type {
  MarkReadStateActionState,
  SendMessageActionState,
} from "@/features/chat/contracts";
import type {
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";
import { createChatActionHandlers } from "./action-handlers";

export type * from "@/features/chat/contracts";

async function handlers() {
  const { chatCommands } = await getServerServices();
  return createChatActionHandlers(chatCommands);
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

export async function toggleReactionAction(
  input: unknown
): Promise<SendMessageActionState> {
  return (await handlers()).toggleReaction(input);
}

export async function markReadStateAction(
  input: unknown
): Promise<MarkReadStateActionState> {
  return (await handlers()).markReadState(input);
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
