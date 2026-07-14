"use client";

import { Popover } from "@base-ui/react/popover";
import { IconBell } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { NotificationList } from "../notification-list";
import { useOptionalNotifications } from "../notification-provider";

function BellContents({ unreadCount }: { unreadCount: number }) {
  return (
    <>
      <IconBell size={22} stroke={1.75} aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -right-3xs -top-3xs flex size-badge items-center justify-center rounded-pill bg-primary text-ui-3xs font-semibold text-on-primary" aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useOptionalNotifications();
  if (!notifications) {
    return (
      <Link href="/notifications" aria-label="Notifications" className="relative flex size-control shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-foreground">
        <BellContents unreadCount={0} />
      </Link>
    );
  }
  const { state, markLoadedSeen, refresh } = notifications;
  const label = state.summary.unreadCount > 0
    ? `Notifications, ${state.summary.unreadCount} unread`
    : "Notifications";
  const triggerClass = "relative flex size-control shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-foreground";

  return (
    <>
      <Link href="/notifications" aria-label={label} className={`${triggerClass} md:hidden`}>
        <BellContents unreadCount={state.summary.unreadCount} />
      </Link>
      <span className="hidden md:inline-flex">
        <Popover.Root
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) {
              void refresh();
              void markLoadedSeen();
            }
          }}
        >
          <Popover.Trigger aria-label={label} className={triggerClass}>
            <BellContents unreadCount={state.summary.unreadCount} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
              <Popover.Popup className="w-notifications max-w-notifications-mobile overflow-hidden rounded-card border border-divider bg-surface" initialFocus={false}>
                <NotificationList compact onNavigate={() => setOpen(false)} />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </span>
    </>
  );
}
