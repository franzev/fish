"use client";

import {
  ActionMenuItem,
  ActionMenuPopup,
  ActionMenuRoot,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { selectVisibleNotifications } from "@fish/core/notification-state";
import { IconArchive, IconBell, IconCheck, IconDots } from "@tabler/icons-react";
import {
  notificationCategoryLabel,
  notificationCategoryOrder,
} from "../../model/presentation";
import { useNotifications } from "../notification-provider";
import { NotificationRow } from "../notification-row";

interface NotificationListProps {
  compact?: boolean;
  onNavigate?: () => void;
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
      <SurfaceHeader
        title={<h2>Notifications</h2>}
        action={
          <ActionMenuRoot>
            <ActionMenuTrigger
              render={
                <IconButton
                  label="Notification actions"
                  appearance="ghost"
                  icon={<IconDots size={20} stroke={1.75} aria-hidden="true" />}
                />
              }
            />
            <ActionMenuPopup>
                  <ActionMenuItem
                    onClick={() => void markAllRead()}
                    disabled={state.summary.unreadCount === 0}
                  >
                    <IconCheck size={20} stroke={1.75} aria-hidden="true" />
                    Mark all as read
                  </ActionMenuItem>
                  <ActionMenuItem
                    onClick={() => void archiveRead()}
                  >
                    <IconArchive size={20} stroke={1.75} aria-hidden="true" />
                    Clear read notifications
                  </ActionMenuItem>
            </ActionMenuPopup>
          </ActionMenuRoot>
        }
      />

      <div className="flex shrink-0 gap-xs border-b border-divider px-md py-xs" aria-label="Notification filter">
        {(["all", "unread"] as const).map((filter) => (
          <Button
            key={filter}
            type="button"
            variant={state.filter === filter ? "secondary" : "ghost"}
            aria-pressed={state.filter === filter}
            onClick={() => void setFilter(filter)}
            className="min-h-control min-w-control px-sm text-ui-sm md:min-w-0"
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
                <h3 id={`notification-${category}`} className="px-sm pb-2xs pt-xs font-sans text-ui-2xs font-medium uppercase tracking-wide text-muted">
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
