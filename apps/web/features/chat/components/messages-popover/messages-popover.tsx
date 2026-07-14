"use client";

import { PopoverHeader } from "@/components/ui/popover-header";
import { Avatar } from "../avatar";
import type {
  MessagePopoverActionState,
  MessagePopoverPreview,
} from "@/features/chat/contracts";
import { formatTimeOfDay, useTimeFormatPreference } from "@/lib/prefs/time-format";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { IconArrowsDiagonal, IconMessages, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

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
  const tabsId = useId();
  const timeFormat = useTimeFormatPreference();
  const label = unreadCount > 0
    ? `Messages, ${unreadCount} unread`
    : "Messages";
  const triggerClass = cn(
    "relative flex size-control shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-foreground",
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
        {unreadCount > 0 && (
          <span
            className="absolute -right-3xs -top-3xs inline-flex min-w-badge items-center justify-center rounded-pill bg-primary px-3xs py-3xs text-ui-3xs font-semibold text-on-primary"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    );
  }

  const latestMessage = activePreview?.latestMessage;
  const latestTime = latestMessage
    ? formatTimeOfDay(latestMessage.createdAt, timeFormat)
    : "";
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
        {unreadCount > 0 && (
          <span
            className="absolute -right-3xs -top-3xs inline-flex min-w-badge items-center justify-center rounded-pill bg-primary px-3xs py-3xs text-ui-3xs font-semibold text-on-primary"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
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
            {unreadCount > 0 && (
              <span
                className="absolute -right-3xs -top-3xs inline-flex min-w-badge items-center justify-center rounded-pill bg-primary px-3xs py-3xs text-ui-3xs font-semibold text-on-primary"
                aria-hidden="true"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
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
                        className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-foreground"
                      >
                        <IconArrowsDiagonal size={20} stroke={1.75} aria-hidden="true" />
                      </Link>
                      <Popover.Close
                        aria-label="Close messages"
                        className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-foreground"
                      >
                        <IconX size={20} stroke={1.75} aria-hidden="true" />
                      </Popover.Close>
                    </>
                  }
                />

                <div
                  role="tablist"
                  aria-label="Message filters"
                  className="flex border-b border-divider px-md"
                >
                  {(["all", "unread"] as const).map((item) => (
                    <button
                      key={item}
                      id={`${tabsId}-${item}`}
                      type="button"
                      role="tab"
                      aria-selected={filter === item}
                      aria-controls={`${tabsId}-panel`}
                      onClick={() => setFilter(item)}
                      className={cn(
                        "min-h-control border-b-2 px-sm text-ui-sm font-medium transition-colors",
                        filter === item
                          ? "border-foreground text-foreground"
                          : "border-transparent text-muted hover:text-body"
                      )}
                    >
                      {item === "all" ? "All" : "Unread"}
                    </button>
                  ))}
                </div>

                <div
                  id={`${tabsId}-panel`}
                  role="tabpanel"
                  aria-labelledby={`${tabsId}-${filter}`}
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
                    <Link
                      href={`/messages/${activePreview.conversationId}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-control items-start gap-sm px-md py-md transition-colors hover:bg-surface-2"
                    >
                      <Avatar
                        profileId={activePreview.participant.id}
                        src={activePreview.participant.avatarUrl ?? undefined}
                        name={activePreview.participant.displayName}
                        size="md"
                        alt=""
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-xs">
                          <span className="truncate text-ui font-semibold text-foreground">
                            {activePreview.participant.displayName}
                          </span>
                          {latestTime && (
                            <time
                              dateTime={latestMessage?.createdAt}
                              className="shrink-0 text-ui-2xs text-muted"
                            >
                              {latestTime}
                            </time>
                          )}
                        </span>
                        <span className="mt-2xs flex items-center gap-xs">
                          <span className="min-w-0 flex-1 truncate text-ui-sm text-muted">
                            {latestText}
                          </span>
                          {unreadCount > 0 && (
                            <span
                              className="inline-flex min-w-badge shrink-0 items-center justify-center rounded-pill bg-primary px-3xs py-3xs text-ui-3xs font-semibold text-on-primary"
                              aria-label={`${unreadCount} unread`}
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  ) : (
                    <div className="px-md py-lg text-center text-ui-sm text-muted">
                      Your coach conversation will appear here.
                    </div>
                  )}
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </span>
    </>
  );
}
