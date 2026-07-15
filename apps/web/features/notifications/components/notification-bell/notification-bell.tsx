"use client";

import { Popover } from "@base-ui/react/popover";
import { IconBell } from "@tabler/icons-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { CountBadge } from "@/components/ui/count-badge";
import { NotificationList } from "../notification-list";
import { useOptionalNotifications } from "../notification-provider";

function renderBellContents(unreadCount: number) {
  return (
    <>
      <IconBell size={20} stroke={1.75} aria-hidden="true" />
      <CountBadge
        count={unreadCount}
        className="absolute -right-3xs -top-3xs"
        aria-hidden="true"
      />
    </>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useOptionalNotifications();
  if (!notifications) {
    return (
      <IconButton
        href="/notifications"
        label="Notifications"
        appearance="ghost"
        className="relative shrink-0 hover:bg-surface-2 hover:text-foreground"
        icon={renderBellContents(0)}
      />
    );
  }
  const { state, refreshAndMarkLoadedSeen } = notifications;
  const label = state.summary.unreadCount > 0
    ? `Notifications, ${state.summary.unreadCount} unread`
    : "Notifications";
  return (
    <>
      <IconButton
        href="/notifications"
        label={label}
        appearance="ghost"
        className="relative shrink-0 hover:bg-surface-2 hover:text-foreground md:hidden"
        icon={renderBellContents(state.summary.unreadCount)}
      />
      <span className="hidden md:inline-flex">
        <Popover.Root
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) {
              void refreshAndMarkLoadedSeen();
            }
          }}
        >
          <Popover.Trigger
            render={
              <IconButton
                label={label}
                appearance="ghost"
                className="relative shrink-0 hover:text-foreground"
                icon={renderBellContents(state.summary.unreadCount)}
              />
            }
          />
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
              <Popover.Popup aria-label="Notifications" className="w-notifications max-w-notifications-mobile overflow-hidden rounded-card border border-divider bg-surface" initialFocus={false}>
                <NotificationList compact onNavigate={() => setOpen(false)} />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </span>
    </>
  );
}
