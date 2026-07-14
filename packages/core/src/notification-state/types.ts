export type NotificationKind =
  | "friendRequestReceived"
  | "friendRequestAccepted"
  | "systemAnnouncement"
  | "productUpdate"
  | "moderationAction"
  | "callMissed"
  | "callCompleted"
  | "messageMention"
  | "messageReply"
  | "messageReaction";

export type NotificationCategory = "actionRequired" | "direct" | "update";
export type NotificationFilter = "all" | "unread";

export interface NotificationActor {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
}

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  category: NotificationCategory;
  categoryRank: number;
  actor: NotificationActor | null;
  actorCount: number;
  eventCount: number;
  conversationId: string | null;
  channelSlug: string | null;
  channelName: string | null;
  messageId: string | null;
  messageSnippet: string | null;
  callId: string | null;
  friendRequestId: string | null;
  moderationActionId: string | null;
  title: string | null;
  body: string | null;
  actionHref: string | null;
  seenAt: string | null;
  readAt: string | null;
  lastEventAt: string;
  changeSeq: number;
}

export interface NotificationSummary {
  unreadCount: number;
  unseenCount: number;
  latestChangeSeq: number;
}

export interface NotificationCursor {
  categoryRank: number;
  lastEventAt: string;
  id: string;
}

export interface NotificationPage {
  items: NotificationItem[];
  nextCursor: NotificationCursor | null;
}

export interface NotificationChange {
  id: string;
  changeSeq: number;
  seenAt: string | null;
  readAt: string | null;
  archivedAt: string | null;
}

export type NotificationRealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

export type NotificationOperationKind =
  | "seen"
  | "read"
  | "markAllRead"
  | "archiveRead";

export interface PendingNotificationOperation {
  id: string;
  kind: NotificationOperationKind;
  itemIds: string[];
  throughChangeSeq: number;
  occurredAt: string;
  previousItems: NotificationItem[];
  previousSummary: NotificationSummary;
  unreadDelta: number;
  unseenDelta: number;
}

export interface NotificationPaginationState {
  nextCursor: NotificationCursor | null;
  isLoading: boolean;
  hasError: boolean;
}

export interface NotificationState {
  items: NotificationItem[];
  filter: NotificationFilter;
  summary: NotificationSummary;
  pagination: NotificationPaginationState;
  realtimeStatus: NotificationRealtimeStatus;
  pendingOperations: Record<string, PendingNotificationOperation>;
  needsRefresh: boolean;
}

export type NotificationEvent =
  | {
      type: "hydrate";
      page: NotificationPage;
      summary: NotificationSummary;
      filter: NotificationFilter;
    }
  | { type: "setFilter"; filter: NotificationFilter }
  | { type: "olderPageRequested" }
  | { type: "olderPageLoaded"; page: NotificationPage }
  | { type: "olderPageFailed" }
  | { type: "authoritativeItemsMerged"; items: NotificationItem[] }
  | { type: "changesApplied"; changes: NotificationChange[] }
  | {
      type: "optimisticOperation";
      operationId: string;
      operationKind: NotificationOperationKind;
      itemIds?: string[];
      throughChangeSeq: number;
      occurredAt: string;
    }
  | { type: "operationConfirmed"; operationId: string }
  | { type: "operationFailed"; operationId: string }
  | { type: "summaryRefreshed"; summary: NotificationSummary }
  | { type: "refreshRequired" }
  | { type: "refreshSatisfied" }
  | { type: "realtimeStatusChanged"; status: NotificationRealtimeStatus }
  | { type: "reset" };
