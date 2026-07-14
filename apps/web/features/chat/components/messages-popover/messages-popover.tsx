"use client";

import { PopoverHeader } from "@/components/ui/popover-header";
import { CountBadge } from "@/components/ui/count-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConversationPreviewRow } from "../conversation-preview-row";
import type {
  MessagePopoverActionState,
  MessagePopoverPreview,
} from "@/features/chat/contracts";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { Tabs } from "@base-ui/react/tabs";
import { IconArrowsDiagonal, IconMessages, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";

type MessageFilter = "all" | "unread";

interface PreviewLoadState {
  loading: boolean;
  notice: string | null;
  previews: MessagePopoverPreview[];
}

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
  const [loadState, setLoadState] = useState<PreviewLoadState>({
    loading: false,
    notice: null,
    previews: [],
  });
  const requestRef = useRef(0);
  const label = unreadCount > 0
    ? `Messages, ${unreadCount} unread`
    : "Messages";
  const triggerClass = cn(
    buttonVariants({ variant: "ghost", controlSize: "square" }),
    "relative shrink-0 hover:bg-surface-2 hover:text-foreground",
    active && "bg-surface-2 text-foreground"
  );
  const canPreview = Boolean(loadPreviewAction);
  const visiblePreviews = filter === "unread"
    ? loadState.previews.filter((preview) => preview.unreadCount > 0)
    : loadState.previews;

  async function loadPreview() {
    if (!loadPreviewAction) return;
    const requestId = ++requestRef.current;
    setLoadState({
      loading: true,
      notice: null,
      previews: [],
    });

    try {
      const result = await loadPreviewAction({});
      if (requestRef.current !== requestId) return;
      setLoadState({
        loading: false,
        notice: result.status === "notice"
          ? result.notice ?? "Messages are still catching up."
          : null,
        previews: result.status === "sent" ? result.previews ?? [] : [],
      });
    } catch {
      if (requestRef.current !== requestId) return;
      setLoadState({
        loading: false,
        notice: "Messages are still catching up.",
        previews: [],
      });
    }
  }

  if (!canPreview) {
    return (
      <Button
        href="/messages"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        variant="ghost"
        controlSize="square"
        className={cn(
          "relative shrink-0 hover:bg-surface-2 hover:text-foreground",
          active && "bg-surface-2 text-foreground"
        )}
      >
        <IconMessages size={22} stroke={1.75} aria-hidden="true" />
        <CountBadge
          count={unreadCount}
          className="absolute -right-3xs -top-3xs"
          aria-hidden="true"
        />
      </Button>
    );
  }

  return (
    <>
      <Button
        href="/messages"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        variant="ghost"
        controlSize="square"
        className={cn(
          "relative shrink-0 hover:bg-surface-2 hover:text-foreground md:hidden",
          active && "bg-surface-2 text-foreground"
        )}
      >
        <IconMessages size={22} stroke={1.75} aria-hidden="true" />
        <CountBadge
          count={unreadCount}
          className="absolute -right-3xs -top-3xs"
          aria-hidden="true"
        />
      </Button>

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
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={triggerClass}
          >
            <IconMessages size={22} stroke={1.75} aria-hidden="true" />
            <CountBadge
              count={unreadCount}
              className="absolute -right-3xs -top-3xs"
              aria-hidden="true"
            />
          </Popover.Trigger>

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
                <PopoverHeader
                  title={
                    <Popover.Title className="font-sans text-heading-sm font-semibold text-foreground">
                      Messages
                    </Popover.Title>
                  }
                  actions={
                    <>
                      <Button
                        href="/messages"
                        aria-label="Open messages"
                        onClick={() => setOpen(false)}
                        variant="ghost"
                        controlSize="square"
                        className="hover:bg-surface-2 hover:text-foreground"
                      >
                        <IconArrowsDiagonal size={20} stroke={1.75} aria-hidden="true" />
                      </Button>
                      <Popover.Close
                        aria-label="Close messages"
                        className={cn(
                          buttonVariants({ variant: "ghost", controlSize: "square" }),
                          "hover:bg-surface-2 hover:text-foreground"
                        )}
                      >
                        <IconX size={20} stroke={1.75} aria-hidden="true" />
                      </Popover.Close>
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
                  {loadState.loading ? (
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
                  ) : filter === "unread" && visiblePreviews.length === 0 ? (
                    <div className="px-md py-lg text-center">
                      <p className="text-ui text-foreground">No unread messages</p>
                      <p className="mt-2xs text-ui-sm text-muted">You’re all caught up.</p>
                    </div>
                  ) : visiblePreviews.length > 0 ? (
                    visiblePreviews.map((preview) => {
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
