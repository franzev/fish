"use client";

import { useEffect } from "react";
import { NotificationList } from "../notification-list";
import { useNotifications } from "../notification-provider";

export function NotificationsScreen() {
  const { refreshAndMarkLoadedSeen } = useNotifications();
  useEffect(() => {
    void refreshAndMarkLoadedSeen();
  }, [refreshAndMarkLoadedSeen]);

  return (
    <div className="mx-auto w-full max-w-content overflow-hidden rounded-card border border-divider bg-surface">
      <NotificationList />
    </div>
  );
}
