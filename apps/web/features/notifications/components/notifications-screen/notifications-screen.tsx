"use client";

import { Card } from "@/components/ui/card";
import { useEffect } from "react";
import { NotificationList } from "../notification-list";
import { useNotifications } from "../notification-provider";

export function NotificationsScreen() {
  const { refreshAndMarkLoadedSeen } = useNotifications();
  useEffect(() => {
    void refreshAndMarkLoadedSeen();
  }, [refreshAndMarkLoadedSeen]);

  return (
    <Card className="mx-auto w-full max-w-content overflow-hidden border border-divider p-0">
      <NotificationList />
    </Card>
  );
}
