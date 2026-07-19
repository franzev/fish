"use client";

import { SurfaceHeader } from "@/components/ui/surface-header";
import { IconButton } from "@/components/ui/icon-button";
import { ConversationPreviewRow } from "../conversation-preview-row";
import type {
  MessagePopoverActionState,
} from "@/features/chat/contracts";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { Tabs } from "@base-ui/react/tabs";
import { IconArrowsDiagonal, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { useIdlePreload } from "@/lib/hooks/use-idle-preload";
import { useMessagePreviews } from "@/features/chat/hooks/use-message-previews";
import { MessagesTriggerButton } from "./messages-trigger-button";

type MessageFilter = "all" | "unread";

export interface MessagesPopoverProps {
  unreadCount: number;
  active?: boolean;
  loadPreviewAction?: (
    input: unknown
  ) => Promise<MessagePopoverActionState>;
}

/** A focused desktop inbox preview; mobile keeps direct page navigation. */
export function MessagesPopover({
  unreadCount,
  active = false,
  loadPreviewAction,
}: MessagesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<MessageFilter>("all");
  const { loadState, loadPreview, visiblePreviews } = useMessagePreviews(loadPreviewAction);
  const label = unreadCount > 0
    ? `Messages, ${unreadCount} unread`
    : "Messages";
  const triggerClass = cn(
    "relative shrink-0 hover:text-foreground",
    active && "bg-surface-2 text-foreground"
  );
  const canPreview = Boolean(loadPreviewAction);
  useIdlePreload({
    enabled: canPreview,
    invalidateKey: unreadCount,
    onPreload: () => void loadPreview(true),
  });
  const filteredPreviews = visiblePreviews(filter);

  if (!canPreview) {
    return (
      <MessagesTriggerButton
        href="/messages"
        label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative shrink-0 hover:bg-surface-2 hover:text-foreground",
          active && "bg-surface-2 text-foreground"
        )}
        unreadCount={unreadCount}
        active={active}
      />
    );
  }

  return (
    <>
      <MessagesTriggerButton
        href="/messages"
        label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative shrink-0 hover:bg-surface-2 hover:text-foreground md:hidden",
          active && "bg-surface-2 text-foreground"
        )}
        unreadCount={unreadCount}
        active={active}
      />

      <span className="hidden md:inline-flex">
        <Popover.Root
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) {
              setFilter("all");
              void loadPreview();
            }
          }}
        >
          <Popover.Trigger
            render={
              <MessagesTriggerButton
                label={label}
                aria-current={active ? "page" : undefined}
                className={triggerClass}
                unreadCount={unreadCount}
                active={active}
              />
            }
          />

          <Popover.Portal>
            <Popover.Positioner
              side="bottom"
              align="end"
              sideOffset={4}
              className="z-50"
            >
              <Popover.Popup
                className="w-notifications max-w-notifications-mobile overflow-hidden rounded-card border border-divider bg-surface"
                initialFocus={false}
              >
                <SurfaceHeader
                  title={
                    <Popover.Title>Messages</Popover.Title>
                  }
                  action={
                    <>
                      <IconButton
                        href="/messages"
                        label="Open messages"
                        onClick={() => setOpen(false)}
                        appearance="ghost"
                        className="hover:bg-surface-2 hover:text-foreground"
                        icon={<IconArrowsDiagonal size={20} stroke={1.75} aria-hidden="true" />}
                      />
                      <Popover.Close
                        render={
                          <IconButton
                            label="Close messages"
                            appearance="ghost"
                            icon={<IconX size={20} stroke={1.75} aria-hidden="true" />}
                          />
                        }
                      />
                    </>
                  }
                />

                <Tabs.Root
                  value={filter}
                  onValueChange={(value) => setFilter(value as MessageFilter)}
                >
                  <Tabs.List
                    aria-label="Message filters"
                    className="flex border-b border-divider px-md"
                  >
                    {(["all", "unread"] as const).map((item) => (
                      <Tabs.Tab
                        key={item}
                        value={item}
                        className={cn(
                          "min-h-control border-b-2 px-sm text-ui-sm font-medium transition-colors",
                          filter === item
                            ? "border-foreground text-foreground"
                            : "border-transparent text-muted hover:text-body"
                        )}
                      >
                        {item === "all" ? "All" : "Unread"}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>

                  <Tabs.Panel
                    value={filter}
                    className="max-h-notifications-panel-h min-h-pagination-slot overflow-y-auto"
                  >
                  {loadState.loading && !loadState.loaded ? (
                    <div
                      role="status"
                      aria-label="Loading messages"
                      className="flex items-start gap-sm p-md"
                    >
                      <span className="size-control shrink-0 animate-pulse rounded-pill bg-surface-2" />
                      <span className="flex min-w-0 flex-1 flex-col gap-xs pt-2xs">
                        <span className="h-skeleton-text w-skeleton-word-29 animate-pulse rounded-pill bg-surface-2" />
                        <span className="h-skeleton-text w-full animate-pulse rounded-pill bg-surface-2" />
                      </span>
                    </div>
                  ) : loadState.notice ? (
                    <div role="status" className="px-md py-lg text-center text-ui-sm text-muted">
                      {loadState.notice} Open messages to continue.
                    </div>
                  ) : filter === "unread" && filteredPreviews.length === 0 ? (
                    <div className="px-md py-lg text-center">
                      <p className="text-ui text-foreground">No unread messages</p>
                      <p className="mt-2xs text-ui-sm text-muted">You’re all caught up.</p>
                    </div>
                  ) : filteredPreviews.length > 0 ? (
                    filteredPreviews.map((preview) => {
                      const latestMessage = preview.latestMessage;
                      const latestText = latestMessage
                        ? `${latestMessage.senderId === preview.participant.id ? "" : "You: "}${latestMessage.text}`
                        : "Start the conversation";
                      return (
                        <ConversationPreviewRow
                          key={preview.conversationId}
                          href={`/messages/${preview.conversationId}`}
                          participant={preview.participant}
                          preview={latestText}
                          latestMessageAt={latestMessage?.createdAt}
                          unreadCount={preview.unreadCount}
                          onNavigate={() => setOpen(false)}
                        />
                      );
                    })
                  ) : (
                    <div className="px-md py-lg text-center text-ui-sm text-muted">
                      Direct conversations will appear here.
                    </div>
                  )}
                  </Tabs.Panel>
                </Tabs.Root>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </span>
    </>
  );
}
