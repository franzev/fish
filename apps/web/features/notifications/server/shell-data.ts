import "server-only";

import type {
  NotificationPage,
  NotificationSummary,
} from "@fish/core/notification-state";
import { getServerServices } from "@/lib/services/runtime/server";
import type { NavigationAttention } from "@/lib/services";

export interface NotificationShellData {
  page: NotificationPage;
  summary: NotificationSummary;
  attention: NavigationAttention[];
}

const emptyData: NotificationShellData = {
  page: { items: [], nextCursor: null },
  summary: { unreadCount: 0, unseenCount: 0, latestChangeSeq: 0 },
  attention: [],
};

export async function getNotificationShellData(): Promise<NotificationShellData> {
  const services = await getServerServices();
  const [page, summary, attention] = await Promise.all([
    services.database.notifications.listPage({ filter: "all" }),
    services.database.notifications.getSummary(),
    services.database.attention.list(),
  ]);

  return {
    page: page.ok ? page.data : emptyData.page,
    summary: summary.ok ? summary.data : emptyData.summary,
    attention: attention.ok ? attention.data : emptyData.attention,
  };
}
