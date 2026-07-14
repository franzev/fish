"use client";

import { Popover } from "@base-ui/react/popover";
import { IconBell } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { CountBadge } from "@/components/ui/count-badge";
import { cn } from "@/lib/utils";
import { NotificationList } from "../notification-list";
import { useOptionalNotifications } from "../notification-provider";

function renderBellContents(unreadCount: number) {
  return (
    <>
      <IconBell size={22} stroke={1.75} aria-hidden="true" />
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
      <Link
        href="/notifications"
        aria-label="Notifications"
        className={cn(
          buttonVariants({ variant: "ghost", controlSize: "square" }),
          "relative shrink-0 hover:bg-surface-2 hover:text-foreground"
        )}
      >
        {renderBellContents(0)}
      </Link>
    );
  }
  const { state, refreshAndMarkLoadedSeen } = notifications;
  const label = state.summary.unreadCount > 0
    ? `Notifications, ${state.summary.unreadCount} unread`
    : "Notifications";
  const triggerClass = cn(
    buttonVariants({ variant: "ghost", controlSize: "square" }),
    "relative shrink-0 hover:bg-surface-2 hover:text-foreground"
  );

  return (
    <>
      <Link href="/notifications" aria-label={label} className={`${triggerClass} md:hidden`}>
        {renderBellContents(state.summary.unreadCount)}
      </Link>
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
          <Popover.Trigger aria-label={label} className={triggerClass}>
            {renderBellContents(state.summary.unreadCount)}
          </Popover.Trigger>
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
