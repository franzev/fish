"use client";

import { useEffect } from "react";
import { NotificationList } from "../notification-list";
import { useNotifications } from "../notification-provider";

export function NotificationsScreen() {
  const { markLoadedSeen, refresh } = useNotifications();
  useEffect(() => {
    void refresh();
    void markLoadedSeen();
  }, [markLoadedSeen, refresh]);

  return (
    <div className="mx-auto w-full max-w-content overflow-hidden rounded-card border border-divider bg-surface">
      <NotificationList />
    </div>
  );
}
