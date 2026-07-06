import type {
  ChatMessageState,
  ChatReadState,
  OutgoingMessageStatus,
  ReplyPreview,
} from "./types";

export function compareChatMessages(
  a: Pick<ChatMessageState, "createdAt" | "id">,
  b: Pick<ChatMessageState, "createdAt" | "id">
): number {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
}

export function mergeChatMessage<T extends ChatMessageState>(
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

export function mergeReadState<T extends ChatReadState>(
  current: T[],
  incoming: T
): T[] {
  const existingIndex = current.findIndex((state) => state.userId === incoming.userId);
  if (existingIndex === -1) {
    return [...current, incoming];
  }

  const next = [...current];
  next[existingIndex] = incoming;
  return next;
}

function isAtOrAfterMessage(
  markerMessageId: string | null | undefined,
  targetMessageId: string,
  messages: ChatMessageState[]
): boolean {
  if (!markerMessageId) {
    return false;
  }

  const targetIndex = messages.findIndex((message) => message.id === targetMessageId);
  const markerIndex = messages.findIndex((message) => message.id === markerMessageId);

  return targetIndex >= 0 && markerIndex >= targetIndex;
}

export function getOutgoingMessageStatus(
  message: ChatMessageState,
  messages: ChatMessageState[],
  participantReadState: ChatReadState | null | undefined
): OutgoingMessageStatus {
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
  messages: ChatMessageState[],
  currentUserId: string,
  currentUserReadState: ChatReadState | null | undefined
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

export function getMessageSnippet(message: ChatMessageState): string {
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
  message: ChatMessageState,
  currentUserId: string,
  participantName: string,
  currentUserName: string
): ReplyPreview {
  return {
    id: message.id,
    authorName: message.senderId === currentUserId ? currentUserName : participantName,
    snippet: getMessageSnippet(message),
  };
}
