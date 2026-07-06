import type {
  ClientChatMessage,
  ClientChatReadState,
} from "@/lib/services";
import type { MessageStatusValue } from "@/components/chat";

export function compareChatMessages(
  a: Pick<ClientChatMessage, "createdAt" | "id">,
  b: Pick<ClientChatMessage, "createdAt" | "id">
): number {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
}

export function mergeChatMessage<T extends ClientChatMessage>(
  current: T[],
  incoming: T,
  localRequestId = incoming.clientRequestId
): T[] {
  const existingIndex = current.findIndex(
    (message) =>
      message.id === incoming.id ||
      message.clientRequestId === incoming.clientRequestId ||
      message.clientRequestId === localRequestId
  );

  if (existingIndex === -1) {
    return [...current, incoming].sort(compareChatMessages);
  }

  const next = [...current];
  next[existingIndex] = { ...next[existingIndex], ...incoming };
  return next.sort(compareChatMessages);
}

function isAtOrAfterMessage(
  markerMessageId: string | null | undefined,
  targetMessageId: string,
  messages: ClientChatMessage[]
): boolean {
  if (!markerMessageId) {
    return false;
  }

  const targetIndex = messages.findIndex((message) => message.id === targetMessageId);
  const markerIndex = messages.findIndex((message) => message.id === markerMessageId);

  return targetIndex >= 0 && markerIndex >= targetIndex;
}

export function getOutgoingMessageStatus(
  message: ClientChatMessage,
  messages: ClientChatMessage[],
  participantReadState: ClientChatReadState | null | undefined
): Extract<MessageStatusValue, "sent" | "delivered" | "read"> {
  if (
    isAtOrAfterMessage(
      participantReadState?.lastReadMessageId,
      message.id,
      messages
    )
  ) {
    return "read";
  }

  if (
    isAtOrAfterMessage(
      participantReadState?.lastDeliveredMessageId,
      message.id,
      messages
    )
  ) {
    return "delivered";
  }

  return "sent";
}

export function countUnreadMessages(
  messages: ClientChatMessage[],
  currentUserId: string,
  currentUserReadState: ClientChatReadState | null | undefined
): number {
  const lastReadIndex = currentUserReadState?.lastReadMessageId
    ? messages.findIndex(
        (message) => message.id === currentUserReadState.lastReadMessageId
      )
    : -1;

  return messages.filter(
    (message, index) => index > lastReadIndex && message.senderId !== currentUserId
  ).length;
}

export function getMessageSnippet(message: ClientChatMessage): string {
  if (message.deletedAt) {
    return "Message deleted";
  }

  const body = message.body.trim();
  if (body.length <= 96) {
    return body;
  }

  return `${body.slice(0, 95)}...`;
}

export function toReplyPreview(
  message: ClientChatMessage,
  currentUserId: string,
  participantName: string,
  currentUserName: string
) {
  return {
    id: message.id,
    authorName: message.senderId === currentUserId ? currentUserName : participantName,
    snippet: getMessageSnippet(message),
  };
}
