import type {
  ChatMessageState,
  ChatReadState,
  OutgoingMessageStatus,
  ReplyPreview,
  UnreadMessageSummary,
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
    // Command acknowledgements return the bare message row, so their mapped
    // attachment list is empty. Keep the ready optimistic attachments (and
    // their signed URLs) until an enriched repository/realtime payload arrives.
    images: (incoming.images?.length ?? 0) > 0
      ? incoming.images
      : existing.images,
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
    (left.stickerId ?? null) === (right.stickerId ?? null) &&
    areReactionsEqual(left.reactions ?? [], right.reactions ?? []) &&
    areImagesEqual(left.images ?? [], right.images ?? [])
  );
}

function areImagesEqual(
  left: NonNullable<ChatMessageState["images"]>,
  right: NonNullable<ChatMessageState["images"]>
): boolean {
  return left.length === right.length && left.every((image, index) => {
    const other = right[index];
    return image.id === other?.id && image.thumbnailUrl === other.thumbnailUrl && image.displayUrl === other.displayUrl;
  });
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
  return getUnreadMessageSummary(
    messages,
    currentUserId,
    currentUserReadState
  ).count;
}

export function getUnreadMessageSummary(
  messages: ChatMessageState[],
  currentUserId: string,
  currentUserReadState: ChatReadState | null | undefined
): UnreadMessageSummary {
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

  const unreadMessages = messages.filter(
    (message, index) =>
      index > lastReadIndex &&
      message.senderId !== currentUserId &&
      !message.deletedAt
  );

  return {
    count: unreadMessages.length,
    oldestUnreadAt: unreadMessages[0]?.createdAt ?? null,
    latestUnreadMessageId: unreadMessages.at(-1)?.id ?? null,
  };
}

// Snippets are measured in Unicode code points, not UTF-16 code units.
// `.length`/`.slice()` operate on UTF-16 units, so an astral character
// (most emoji are a surrogate pair) counts as 2 and a naive slice can cut
// a pair in half, producing an invalid lone surrogate. Array.from(body)
// iterates by code point, so a surrogate pair is always kept whole. The
// ellipsis is a single code point (U+2026, "…"), so a truncated snippet is
// at most 95 body code points + 1 ellipsis code point = 96 code points.
const MAX_SNIPPET_CODE_POINTS = 96;
const SNIPPET_ELLIPSIS = "…";

export function getMessageSnippet(message: ChatMessageState): string {
  if (message.deletedAt) {
    return "Message deleted";
  }

  const body = message.body.trim();
  if (!body && message.stickerId) {
    return "Sticker";
  }
  if (!body && message.gif) {
    return "GIF";
  }
  if (!body && (message.images?.length ?? 0) > 0) {
    const attachments = message.images ?? [];
    if (attachments.length === 1) return attachments[0]?.kind === "file" ? "File" : "Image";
    return attachments.every((attachment) => attachment.kind !== "file")
      ? `${attachments.length} images`
      : `${attachments.length} files`;
  }
  const codePoints = Array.from(body);
  if (codePoints.length <= MAX_SNIPPET_CODE_POINTS) {
    return body;
  }

  return `${codePoints.slice(0, MAX_SNIPPET_CODE_POINTS - 1).join("")}${SNIPPET_ELLIPSIS}`;
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
