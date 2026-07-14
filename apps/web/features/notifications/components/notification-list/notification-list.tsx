"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/features/chat";
import { cn } from "@/lib/utils";
import {
  selectVisibleNotifications,
  type NotificationItem,
} from "@fish/core/notification-state";
import { Menu } from "@base-ui/react/menu";
import {
  IconBell,
  IconCheck,
  IconDots,
  IconMessageCircle,
  IconPhone,
  IconUserPlus,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  formatNotificationTime,
  notificationCategoryLabel,
  notificationCategoryOrder,
  notificationContext,
  notificationTitle,
} from "../../model/presentation";
import { useNotifications } from "../notification-provider";

interface NotificationListProps {
  compact?: boolean;
  onNavigate?: () => void;
}

function NotificationKindIcon({ item }: { item: NotificationItem }) {
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

function NotificationIdentity({ item }: { item: NotificationItem }) {
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
  return <NotificationKindIcon item={item} />;
}

function NotificationRow({
  item,
  onNavigate,
}: {
  item: NotificationItem;
  onNavigate?: () => void;
}) {
  const { markRead, acknowledgeModeration } = useNotifications();
  const context = notificationContext(item);
  const content = (
    <>
      <NotificationIdentity item={item} />
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
  const mainClassName = cn(
    "flex min-h-control min-w-0 flex-1 items-start gap-sm rounded-control px-sm py-sm text-left transition-colors",
    "hover:bg-surface-2 focus-visible:bg-surface-2"
  );
  const rowClassName = cn(
    "flex w-full items-center gap-xs rounded-control",
    item.readAt === null ? "bg-surface-2/50" : "bg-transparent"
  );
  const activate = () => {
    void markRead(item);
    onNavigate?.();
  };

  const requiresAcknowledgement = item.kind === "moderationAction" &&
    item.moderationActionId !== null;
  const main = item.actionHref ? (
    <Link href={item.actionHref} onClick={activate} className={mainClassName}>
      {content}
    </Link>
  ) : requiresAcknowledgement ? (
    <div className={mainClassName}>{content}</div>
  ) : (
    <button type="button" onClick={activate} className={mainClassName}>
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

export function NotificationList({ compact = false, onNavigate }: NotificationListProps) {
  const {
    state,
    notice,
    isRefreshing,
    archiveBatchId,
    setFilter,
    loadOlder,
    markAllRead,
    archiveRead,
    undoArchive,
  } = useNotifications();
  const items = selectVisibleNotifications(state);

  return (
    <div className={cn("flex min-h-0 flex-col", compact && "h-notifications-panel-h") }>
      <div className="flex shrink-0 items-center gap-xs border-b border-divider px-md py-sm">
        <h2 className="min-w-0 flex-1 text-heading-sm">Notifications</h2>
        <Menu.Root>
          <Menu.Trigger
            aria-label="Notification actions"
            className="flex size-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <IconDots size={20} stroke={1.75} aria-hidden="true" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
              <Menu.Popup className="min-w-menu rounded-card border border-divider bg-surface p-3xs">
                <Menu.Item
                  onClick={() => void markAllRead()}
                  disabled={state.summary.unreadCount === 0}
                  className="flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2"
                >
                  <IconCheck size={20} stroke={1.75} aria-hidden="true" />
                  Mark all as read
                </Menu.Item>
                <Menu.Item
                  onClick={() => void archiveRead()}
                  className="flex min-h-control cursor-pointer items-center rounded-control px-sm text-ui-sm text-foreground data-[highlighted]:bg-surface-2"
                >
                  Clear read notifications
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>

      <div className="flex shrink-0 gap-xs border-b border-divider px-md py-xs" aria-label="Notification filter">
        {(["all", "unread"] as const).map((filter) => (
          <Button
            key={filter}
            type="button"
            variant={state.filter === filter ? "secondary" : "ghost"}
            aria-pressed={state.filter === filter}
            onClick={() => void setFilter(filter)}
            className="min-h-control px-sm text-ui-sm"
          >
            {filter === "all" ? "All" : "Unread"}
          </Button>
        ))}
      </div>

      {(notice || archiveBatchId) && (
        <div className="flex shrink-0 items-center gap-sm border-b border-divider px-md py-xs text-ui-sm text-notice" role="status">
          <span className="min-w-0 flex-1">
            {notice ?? "Read notifications cleared."}
          </span>
          {archiveBatchId && (
            <Button type="button" variant="ghost" onClick={() => void undoArchive()} className="px-xs">
              Undo
            </Button>
          )}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1" viewportClassName="px-xs py-xs">
        {items.length === 0 ? (
          <div className="px-md py-xl text-center">
            <IconBell className="mx-auto mb-sm text-muted" size={28} stroke={1.5} aria-hidden="true" />
            <p className="text-ui text-body">
              {isRefreshing ? "Loading notifications…" : state.filter === "unread" ? "You’re all caught up." : "Nothing needs your attention."}
            </p>
          </div>
        ) : (
          notificationCategoryOrder.map((category) => {
            const sectionItems = items.filter((item) => item.category === category);
            if (sectionItems.length === 0) return null;
            return (
              <section key={category} aria-labelledby={`notification-${category}`} className="mb-md last:mb-0">
                <h3 id={`notification-${category}`} className="px-sm pb-2xs pt-xs text-ui-2xs font-medium uppercase tracking-wide text-muted">
                  {notificationCategoryLabel[category]}
                </h3>
                <div className="flex flex-col gap-3xs">
                  {sectionItems.map((item) => (
                    <NotificationRow key={item.id} item={item} onNavigate={onNavigate} />
                  ))}
                </div>
              </section>
            );
          })
        )}
        {state.pagination.nextCursor && (
          <div className="px-sm py-sm text-center">
            <Button
              type="button"
              variant="ghost"
              loading={state.pagination.isLoading}
              onClick={() => void loadOlder()}
            >
              Load earlier
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
