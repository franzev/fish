"use client";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/features/chat";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@fish/core/notification-state";
import {
  IconBell,
  IconMessageCircle,
  IconPhone,
  IconUserPlus,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  formatNotificationTime,
  notificationContext,
  notificationTitle,
} from "../../model/presentation";
import { useNotifications } from "../notification-provider";

export interface NotificationRowProps {
  item: NotificationItem;
  onNavigate?: () => void;
}

function renderIdentity(item: NotificationItem) {
  if (item.actor) {
    return (
      <Avatar
        profileId={item.actor.id}
        src={item.actor.avatarUrl ?? undefined}
        name={item.actor.displayName}
        size="md"
        alt=""
      />
    );
  }

  const Icon = item.kind.startsWith("friend")
    ? IconUserPlus
    : item.kind.startsWith("call")
      ? IconPhone
      : item.kind.startsWith("message")
        ? IconMessageCircle
        : IconBell;

  return (
    <span className="flex size-control shrink-0 items-center justify-center rounded-pill bg-surface-2 text-muted">
      <Icon size={20} stroke={1.75} aria-hidden="true" />
    </span>
  );
}

export function NotificationRow({ item, onNavigate }: NotificationRowProps) {
  const { markRead, acknowledgeModeration } = useNotifications();
  const context = notificationContext(item);
  const requiresAcknowledgement = item.kind === "moderationAction" &&
    item.moderationActionId !== null;
  const content = (
    <>
      {renderIdentity(item)}
      <span className="min-w-0 flex-1">
        <span className={cn(
          "block text-ui-sm text-body",
          item.readAt === null && "font-semibold text-foreground"
        )}>
          {notificationTitle(item)}
        </span>
        {context && (
          <span className="mt-2xs line-clamp-2 block text-ui-xs text-muted">
            {context}
          </span>
        )}
        <span className="mt-2xs block text-ui-2xs text-muted">
          {item.channelName ? `# ${item.channelName} · ` : ""}
          {formatNotificationTime(item.lastEventAt)}
        </span>
      </span>
      {item.readAt === null && (
        <span className="mt-xs size-2xs shrink-0 rounded-pill bg-foreground" aria-hidden="true" />
      )}
      <span className="sr-only">{item.readAt === null ? "Unread" : "Read"}</span>
    </>
  );
  const interactiveClassName =
    "flex min-h-control min-w-0 flex-1 items-start gap-sm rounded-control px-sm py-sm text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2";
  const staticClassName =
    "flex min-h-control min-w-0 flex-1 items-start gap-sm rounded-control px-sm py-sm text-left";
  const rowClassName = cn(
    "flex w-full items-center gap-xs rounded-control",
    item.readAt === null ? "bg-surface-2/50" : "bg-transparent"
  );
  const activate = () => {
    void markRead(item);
    onNavigate?.();
  };

  const main = item.actionHref ? (
    <Link href={item.actionHref} onClick={activate} className={interactiveClassName}>
      {content}
    </Link>
  ) : requiresAcknowledgement ? (
    <div className={staticClassName}>{content}</div>
  ) : (
    <button type="button" onClick={activate} className={interactiveClassName}>
      {content}
    </button>
  );

  return (
    <div className={rowClassName}>
      {main}
      {requiresAcknowledgement && (
        <Button
          type="button"
          variant="secondary"
          className="mr-xs shrink-0 px-sm text-ui-sm"
          onClick={() => void acknowledgeModeration(item)}
        >
          Got it
        </Button>
      )}
    </div>
  );
}
