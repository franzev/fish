import type {
  NotificationCategory,
  NotificationItem,
} from "@fish/core/notification-state";

export const notificationCategoryOrder: NotificationCategory[] = [
  "actionRequired",
  "direct",
  "update",
];

export const notificationCategoryLabel: Record<NotificationCategory, string> = {
  actionRequired: "Needs you",
  direct: "For you",
  update: "Updates",
};

function actorLead(item: NotificationItem): string {
  const actor = item.actor?.displayName ?? "Someone";
  if (item.actorCount > 1) {
    return `${actor} and ${item.actorCount - 1} ${item.actorCount === 2 ? "other" : "others"}`;
  }
  return actor;
}

export function notificationTitle(item: NotificationItem): string {
  const actor = actorLead(item);
  switch (item.kind) {
    case "friendRequestReceived":
      return `${actor} sent you a friend request`;
    case "friendRequestAccepted":
      return `${actor} accepted your friend request`;
    case "callMissed":
      return item.eventCount > 1
        ? `${item.eventCount} missed calls from ${actor}`
        : `You missed a call from ${actor}`;
    case "callCompleted":
      return `Call with ${actor} completed`;
    case "messageMention":
      return `${actor} mentioned you`;
    case "messageReply":
      return `${actor} replied to you`;
    case "messageReaction":
      return item.eventCount > 1
        ? `${actor} added ${item.eventCount} reactions`
        : `${actor} reacted to your message`;
    case "moderationAction":
      return item.title ?? "A moderation update";
    case "systemAnnouncement":
    case "productUpdate":
      return item.title ?? "A FISH update";
  }
}

export function notificationContext(item: NotificationItem): string | null {
  if (item.body) return item.body;
  if (item.messageSnippet) return item.messageSnippet;
  if (item.channelName) return `# ${item.channelName}`;
  return null;
}

export function formatNotificationTime(
  timestamp: string,
  now = Date.now()
): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000));
  if (elapsedSeconds < 60) return "Now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}
