import type { ClientChatData } from "@/lib/services";

export const chat: ClientChatData = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  currentUserId: "client-1",
  currentUserRole: "client",
  currentUserDisplayName: "Franz",
  participant: {
    id: "coach-1",
    displayName: "Gwyn",
    role: "coach",
  },
  messages: [
    {
      id: "message-1",
      conversationId: "11111111-1111-4111-8111-111111111111",
      senderId: "coach-1",
      senderRole: "coach",
      body: "How did practice feel today?",
      clientRequestId: "seed-1",
      createdAt: "2026-07-05T00:00:00.000Z",
      editedAt: null,
      deletedAt: null,
      replyToMessageId: null,
      reactions: [],
    },
  ],
  readStates: [
    {
      userId: "client-1",
      lastDeliveredMessageId: "message-1",
      deliveredAt: "2026-07-05T00:00:01.000Z",
      lastReadMessageId: null,
      readAt: null,
    },
    {
      userId: "coach-1",
      lastDeliveredMessageId: null,
      deliveredAt: null,
      lastReadMessageId: null,
      readAt: null,
    },
  ],
  participantPresence: {
    lastSeenAt: "2026-07-05T00:00:00.000Z",
    sessions: [],
  },
};

export const searchableCommunityChat: ClientChatData = {
  ...chat,
  kind: "community",
  channelId: "22222222-2222-4222-8222-222222222222",
  channelSlug: "general",
  channelName: "general",
  title: "general",
  participantPresence: undefined,
};
