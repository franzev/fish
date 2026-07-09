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
  const existing = next[existingIndex];
  const merged = {
    ...existing,
    ...incoming,
    // Server acks for commands (reactions, deletes) return the bare message
    // row without the resolved display name — keep the name we already know
    // instead of falling back to the anonymous placeholder.
    senderDisplayName: incoming.senderDisplayName ?? existing.senderDisplayName,
  };
  if (areChatMessagesEqual(existing, merged)) {
    return current;
  }

  next[existingIndex] = merged;
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
  if (areReadStatesEqual(next[existingIndex], incoming)) {
    return current;
  }

  next[existingIndex] = incoming;
  return next;
}

function areChatMessagesEqual(
  left: ChatMessageState,
  right: ChatMessageState
): boolean {
  return (
    left.id === right.id &&
    left.conversationId === right.conversationId &&
    left.senderId === right.senderId &&
    left.senderRole === right.senderRole &&
    (left.senderDisplayName ?? null) === (right.senderDisplayName ?? null) &&
    left.body === right.body &&
    left.clientRequestId === right.clientRequestId &&
    left.createdAt === right.createdAt &&
    (left.editedAt ?? null) === (right.editedAt ?? null) &&
    (left.deletedAt ?? null) === (right.deletedAt ?? null) &&
    (left.replyToMessageId ?? null) === (right.replyToMessageId ?? null) &&
    (left.localStatus ?? null) === (right.localStatus ?? null) &&
    (left.failureReason ?? null) === (right.failureReason ?? null) &&
    areReactionsEqual(left.reactions ?? [], right.reactions ?? [])
  );
}

function areReactionsEqual(
  left: NonNullable<ChatMessageState["reactions"]>,
  right: NonNullable<ChatMessageState["reactions"]>
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (reaction, index) =>
        reaction.emoji === right[index]?.emoji &&
        reaction.count === right[index]?.count &&
        reaction.byMe === right[index]?.byMe
    )
  );
}

function areReadStatesEqual(left: ChatReadState, right: ChatReadState): boolean {
  return (
    left.userId === right.userId &&
    left.lastDeliveredMessageId === right.lastDeliveredMessageId &&
    left.deliveredAt === right.deliveredAt &&
    left.lastReadMessageId === right.lastReadMessageId &&
    left.readAt === right.readAt
  );
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

  if (markerIndex === -1) {
    // The marker id is set but not present among the currently loaded
    // (newest-anchored) messages — e.g. pagination hasn't loaded back that
    // far yet. Treat it as strictly older than everything loaded, so it
    // marks no loaded message as delivered/read. This is a distinct case
    // from "no marker at all" (handled above): the read and delivered
    // markers are each routed through this function independently by
    // getOutgoingMessageStatus, so a not-yet-loaded read marker must never
    // suppress a delivered marker that is among the loaded messages.
    return false;
  }

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
  // A read marker id that findIndex can't locate means the reader's last-read
  // position is older than every currently loaded (newest-anchored)
  // message. The -1 fallback below then counts every loaded
  // other-participant message as unread, which is the correct conservative
  // answer until pagination loads back far enough to find the real marker.
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
