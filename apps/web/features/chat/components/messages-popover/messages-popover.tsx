"use client";

import { PopoverHeader } from "@/components/ui/popover-header";
import { CountBadge } from "@/components/ui/count-badge";
import { buttonVariants } from "@/components/ui/button";
import { ConversationPreviewRow } from "../conversation-preview-row";
import type {
  MessagePopoverActionState,
  MessagePopoverPreview,
} from "@/features/chat/contracts";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { Tabs } from "@base-ui/react/tabs";
import { IconArrowsDiagonal, IconMessages, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useRef, useState } from "react";

type MessageFilter = "all" | "unread";

interface PreviewLoadState {
  conversationId: string | null;
  loading: boolean;
  notice: string | null;
  preview: MessagePopoverPreview | null;
}

export interface MessagesPopoverProps {
  conversationId: string | null;
  unreadCount: number;
  active?: boolean;
  loadPreviewAction?: (
    input: unknown
  ) => Promise<MessagePopoverActionState>;
}

/** A focused desktop inbox preview; mobile keeps direct page navigation. */
export function MessagesPopover({
  conversationId,
  unreadCount,
  active = false,
  loadPreviewAction,
}: MessagesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<MessageFilter>("all");
  const [loadState, setLoadState] = useState<PreviewLoadState>({
    conversationId: null,
    loading: false,
    notice: null,
    preview: null,
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
  const canPreview = Boolean(conversationId && loadPreviewAction);
  const activePreview = loadState.conversationId === conversationId
    ? loadState.preview
    : null;
  const isLoading = loadState.conversationId === conversationId
    && loadState.loading;
  const notice = loadState.conversationId === conversationId
    ? loadState.notice
    : null;

  async function loadPreview() {
    if (!conversationId || !loadPreviewAction) return;
    const requestId = ++requestRef.current;
    setLoadState({
      conversationId,
      loading: true,
      notice: null,
      preview: null,
    });

    try {
      const result = await loadPreviewAction({ conversationId });
      if (requestRef.current !== requestId) return;
      setLoadState({
        conversationId,
        loading: false,
        notice: result.status === "notice"
          ? result.notice ?? "Messages are still catching up."
          : null,
        preview: result.status === "sent" ? result.preview ?? null : null,
      });
    } catch {
      if (requestRef.current !== requestId) return;
      setLoadState({
        conversationId,
        loading: false,
        notice: "Messages are still catching up.",
        preview: null,
      });
    }
  }

  if (!canPreview) {
    return (
      <Link
        href="/messages"
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
      </Link>
    );
  }

  const latestMessage = activePreview?.latestMessage;
  const latestText = latestMessage
    ? `${latestMessage.senderId === activePreview?.participant.id ? "" : "You: "}${latestMessage.text}`
    : "Start the conversation";
  const showConversation = filter === "all" || unreadCount > 0;

  return (
    <>
      <Link
        href="/messages"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(triggerClass, "md:hidden")}
      >
        <IconMessages size={22} stroke={1.75} aria-hidden="true" />
        <CountBadge
          count={unreadCount}
          className="absolute -right-3xs -top-3xs"
          aria-hidden="true"
        />
      </Link>

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
                      <Link
                        href="/messages"
                        aria-label="Open messages"
                        onClick={() => setOpen(false)}
                        className={cn(
                          buttonVariants({ variant: "ghost", controlSize: "square" }),
                          "hover:bg-surface-2 hover:text-foreground"
                        )}
                      >
                        <IconArrowsDiagonal size={20} stroke={1.75} aria-hidden="true" />
                      </Link>
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
                  {isLoading ? (
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
                  ) : notice ? (
                    <div role="status" className="px-md py-lg text-center text-ui-sm text-muted">
                      {notice} Open messages to continue.
                    </div>
                  ) : !showConversation ? (
                    <div className="px-md py-lg text-center">
                      <p className="text-ui text-foreground">No unread messages</p>
                      <p className="mt-2xs text-ui-sm text-muted">You’re all caught up.</p>
                    </div>
                  ) : activePreview ? (
                    <ConversationPreviewRow
                      href={`/messages/${activePreview.conversationId}`}
                      participant={activePreview.participant}
                      preview={latestText}
                      latestMessageAt={latestMessage?.createdAt}
                      unreadCount={unreadCount}
                      onNavigate={() => setOpen(false)}
                    />
                  ) : (
                    <div className="px-md py-lg text-center text-ui-sm text-muted">
                      Your coach conversation will appear here.
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
