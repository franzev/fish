import type { NotificationItem } from "@fish/core/notification-state";
import type {
  AttentionRealtimeService,
  NavigationAttentionRepository,
  NotificationCommandService,
  NotificationRealtimeService,
  NotificationRepository,
} from "@/lib/services";

export function notificationItem(
  input: Partial<NotificationItem> & Pick<NotificationItem, "id" | "kind" | "category" | "categoryRank">
): NotificationItem {
  return {
    actor: { id: "actor-1", displayName: "Sam", username: "sam" },
    actorCount: 1,
    eventCount: 1,
    conversationId: null,
    channelSlug: null,
    channelName: null,
    messageId: null,
    messageSnippet: null,
    callId: null,
    friendRequestId: null,
    moderationActionId: null,
    title: null,
    body: null,
    actionHref: null,
    seenAt: null,
    readAt: null,
    lastEventAt: "2026-07-14T08:00:00.000Z",
    changeSeq: 1,
    ...input,
  };
}

export const notificationStoryItems: NotificationItem[] = [
  notificationItem({
    id: "friend",
    kind: "friendRequestReceived",
    category: "actionRequired",
    categoryRank: 2,
    friendRequestId: "request-1",
  }),
  notificationItem({
    id: "mention",
    kind: "messageMention",
    category: "direct",
    categoryRank: 1,
    channelName: "general",
    messageSnippet: "Can you help me practice this phrase?",
  }),
  notificationItem({
    id: "call",
    kind: "callCompleted",
    category: "update",
    categoryRank: 0,
    readAt: "2026-07-14T08:20:00.000Z",
  }),
];

export function createNotificationStoryServices(items = notificationStoryItems) {
  const repository: NotificationRepository = {
    getSummary: async () => ({
      ok: true,
      data: {
        unreadCount: items.filter((item) => item.readAt === null).length,
        unseenCount: items.filter((item) => item.seenAt === null).length,
        latestChangeSeq: 1,
      },
    }),
    listPage: async ({ filter }) => ({
      ok: true,
      data: {
        items: filter === "unread" ? items.filter((item) => item.readAt === null) : items,
        nextCursor: null,
      },
    }),
    listChanges: async () => ({ ok: true, data: [] }),
  };
  const commands = {
    execute: async () => ({ ok: true as const, updated: 1 }),
  } as NotificationCommandService;
  const realtime: NotificationRealtimeService = { subscribe: () => () => undefined };
  const attentionRepository: NavigationAttentionRepository = {
    list: async () => ({ ok: true, data: [] }),
  };
  const attentionRealtime: AttentionRealtimeService = {
    subscribe: () => () => undefined,
  };
  return { repository, commands, realtime, attentionRepository, attentionRealtime };
}
