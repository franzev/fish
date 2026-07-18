/** Shared direct-chat typing broadcast contract. Broadcasts are wake-up
 * signals only; persisted messages and read states remain canonical. */
export interface ChatTypingPayload {
  userId: string;
  typing: boolean;
}

export const chatTypingContract = {
  topic(conversationId: string): string {
    return `conversation:${conversationId}:typing`;
  },
  event: "typing",
  payloadKeys: {
    userId: "userId",
    typing: "typing",
  },
  receiveOwnBroadcasts: false,
} as const;
