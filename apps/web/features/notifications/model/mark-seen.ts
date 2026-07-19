import type {
  NotificationItem,
  NotificationPage,
  NotificationSummary,
} from "@fish/core/notification-state";
import type { NotificationCommandResult } from "@/lib/services";

export interface MarkSeenSettledSnapshot {
  page: NotificationPage | null;
  summary: NotificationSummary | null;
}

export interface MarkSeenPlanInput {
  page: NotificationPage;
  summary: NotificationSummary;
  commandResult: NotificationCommandResult;
  attempt: number;
  settled?: MarkSeenSettledSnapshot;
  seenAt?: string;
}

export interface MarkSeenPlan {
  nextPage: NotificationPage;
  nextSummary: NotificationSummary;
  notice: string | null;
  retry: boolean;
}

export function unseenNotificationIds(page: NotificationPage): string[] {
  return page.items.filter((item) => item.seenAt === null).map((item) => item.id);
}

export function markSeenThroughChangeSeq(
  page: NotificationPage,
  summary: NotificationSummary
): number {
  return Math.max(summary.latestChangeSeq, ...page.items.map((item) => item.changeSeq));
}

function markItemsSeen(
  items: NotificationItem[],
  ids: ReadonlySet<string>,
  seenAt: string
): NotificationItem[] {
  return items.map((item) => ids.has(item.id) ? { ...item, seenAt } : item);
}

export function planMarkSeenOutcome({
  page,
  summary,
  commandResult,
  attempt,
  settled,
  seenAt = "seen",
}: MarkSeenPlanInput): MarkSeenPlan {
  const unseenIds = unseenNotificationIds(page);
  if (unseenIds.length === 0) {
    return { nextPage: page, nextSummary: summary, notice: null, retry: false };
  }

  if (!commandResult.ok) {
    return {
      nextPage: page,
      nextSummary: summary,
      notice: commandResult.notice,
      retry: false,
    };
  }

  const optimisticPage: NotificationPage = {
    ...page,
    items: markItemsSeen(page.items, new Set(unseenIds), seenAt),
  };
  const settledPage = settled?.page;
  const settledSummary = settled?.summary;
  if (settledPage && settledSummary) {
    return {
      nextPage: settledPage,
      nextSummary: settledSummary,
      notice: null,
      retry: unseenNotificationIds(settledPage).length > 0 && attempt < 2,
    };
  }

  if (commandResult.updated >= unseenIds.length) {
    return {
      nextPage: optimisticPage,
      nextSummary: {
        ...summary,
        unseenCount: Math.max(0, summary.unseenCount - unseenIds.length),
      },
      notice: "Notifications will catch up when the connection settles.",
      retry: false,
    };
  }

  return {
    nextPage: page,
    nextSummary: summary,
    notice: "Notifications will catch up when the connection settles.",
    retry: false,
  };
}
