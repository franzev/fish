import type {
  NotificationCategory,
  NotificationItem,
  NotificationState,
} from "./types";

export function compareNotificationItems(
  left: NotificationItem,
  right: NotificationItem
): number {
  if (left.categoryRank !== right.categoryRank) {
    return right.categoryRank - left.categoryRank;
  }
  const time = Date.parse(right.lastEventAt) - Date.parse(left.lastEventAt);
  return time || right.id.localeCompare(left.id);
}

export function mergeNotificationItems(
  current: NotificationItem[],
  incoming: NotificationItem[]
): NotificationItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (!existing || item.changeSeq >= existing.changeSeq) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort(compareNotificationItems);
}

export function selectVisibleNotifications(
  state: NotificationState
): NotificationItem[] {
  return state.filter === "unread"
    ? state.items.filter((item) => item.readAt === null)
    : state.items;
}

export function selectNotificationsByCategory(
  state: NotificationState,
  category: NotificationCategory
): NotificationItem[] {
  return selectVisibleNotifications(state).filter(
    (item) => item.category === category
  );
}

export function selectUnreadNotificationIds(
  state: NotificationState
): string[] {
  return state.items
    .filter((item) => item.readAt === null)
    .map((item) => item.id);
}

export function selectHasUnreadNotifications(state: NotificationState): boolean {
  return state.summary.unreadCount > 0;
}
