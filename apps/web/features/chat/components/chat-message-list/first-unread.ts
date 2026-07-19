export interface UnreadBoundary {
  count: number;
  oldestUnreadAt: string | null;
}

function subMillisecondFraction(timestamp: string): string {
  const fraction = timestamp.match(/\.(\d+)/)?.[1] ?? "";
  return fraction.padEnd(9, "0").slice(3, 9);
}

export function timestampsMatch(left: string, right: string): boolean {
  if (left === right) return true;
  return (
    Date.parse(left) === Date.parse(right) &&
    subMillisecondFraction(left) === subMillisecondFraction(right)
  );
}

export function findFirstUnreadMessageId(
  messages: Array<{
    id: string;
    senderId: string;
    createdAt: string;
    deletedAt?: string | null;
  }>,
  boundary: UnreadBoundary,
  currentUserId: string
): string | null {
  if (boundary.count <= 0 || !boundary.oldestUnreadAt) return null;
  return (
    messages.find(
      (message) =>
        message.senderId !== currentUserId &&
        !message.deletedAt &&
        timestampsMatch(message.createdAt, boundary.oldestUnreadAt!)
    )?.id ?? null
  );
}
