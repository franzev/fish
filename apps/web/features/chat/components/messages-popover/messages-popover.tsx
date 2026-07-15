"use client";

import { SurfaceHeader } from "@/components/ui/surface-header";
import { CountBadge } from "@/components/ui/count-badge";
import { IconButton } from "@/components/ui/icon-button";
import { ConversationPreviewRow } from "../conversation-preview-row";
import type {
  MessagePopoverActionState,
  MessagePopoverPreview,
} from "@/features/chat/contracts";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { Tabs } from "@base-ui/react/tabs";
import { IconArrowsDiagonal, IconMessages, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";

type MessageFilter = "all" | "unread";

interface PreviewLoadState {
  loaded: boolean;
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
    loaded: false,
    loading: false,
    notice: null,
    previews: [],
  });
  const successfulLoadRef = useRef(false);
  const inFlightRequestRef = useRef<Promise<void> | null>(null);
  const previousUnreadCountRef = useRef(unreadCount);
  const requestRef = useRef(0);
  const label = unreadCount > 0
    ? `Messages, ${unreadCount} unread`
    : "Messages";
  const triggerClass = cn(
    "relative shrink-0 hover:text-foreground",
    active && "bg-surface-2 text-foreground"
  );
  const canPreview = Boolean(loadPreviewAction);
  const visiblePreviews = filter === "unread"
    ? loadState.previews.filter((preview) => preview.unreadCount > 0)
    : loadState.previews;

  const loadPreview = useCallback((force = false): Promise<void> => {
    if (!loadPreviewAction || (successfulLoadRef.current && !force)) {
      return Promise.resolve();
    }
    if (inFlightRequestRef.current) return inFlightRequestRef.current;

    const requestId = ++requestRef.current;
    setLoadState((current) => ({
      ...current,
      loading: true,
      notice: current.loaded ? current.notice : null,
    }));

    const request = (async () => {
      try {
        const result = await loadPreviewAction({});
        if (requestRef.current !== requestId) return;
        if (result.status === "sent") successfulLoadRef.current = true;
        setLoadState((current) => ({
          loaded: true,
          loading: false,
          notice: result.status === "notice"
            ? current.previews.length > 0
              ? null
              : result.notice ?? "Messages are still catching up."
            : null,
          previews: result.status === "sent"
            ? result.previews ?? []
            : current.previews,
        }));
      } catch {
        if (requestRef.current !== requestId) return;
        setLoadState((current) => ({
          ...current,
          loaded: true,
          loading: false,
          notice: current.previews.length > 0
            ? null
            : "Messages are still catching up.",
        }));
      } finally {
        if (requestRef.current === requestId) {
          inFlightRequestRef.current = null;
        }
      }
    })();

    inFlightRequestRef.current = request;
    return request;
  }, [loadPreviewAction]);

  useEffect(() => {
    if (!loadPreviewAction) return;

    let idleCallbackId: number | undefined;
    let timeoutId: number | undefined;
    const unreadCountChanged = previousUnreadCountRef.current !== unreadCount;
    previousUnreadCountRef.current = unreadCount;

    const preload = () => {
      void loadPreview(unreadCountChanged);
    };
    const schedulePreload = () => {
      const requestIdleCallback = Reflect.get(window, "requestIdleCallback") as
        | Window["requestIdleCallback"]
        | undefined;
      if (requestIdleCallback) {
        idleCallbackId = requestIdleCallback.call(window, preload, { timeout: 2_000 });
      } else {
        timeoutId = window.setTimeout(preload, 0);
      }
    };

    if (document.readyState === "complete") {
      schedulePreload();
    } else {
      window.addEventListener("load", schedulePreload, { once: true });
    }

    return () => {
      window.removeEventListener("load", schedulePreload);
      const cancelIdleCallback = Reflect.get(window, "cancelIdleCallback") as
        | Window["cancelIdleCallback"]
        | undefined;
      if (idleCallbackId !== undefined && cancelIdleCallback) {
        cancelIdleCallback.call(window, idleCallbackId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [loadPreview, loadPreviewAction, unreadCount]);

  if (!canPreview) {
    return (
      <IconButton
        href="/messages"
        label={label}
        aria-current={active ? "page" : undefined}
        appearance="ghost"
        className={cn(
          "relative shrink-0 hover:bg-surface-2 hover:text-foreground",
          active && "bg-surface-2 text-foreground"
        )}
        icon={
          <>
            <IconMessages size={20} stroke={1.75} aria-hidden="true" />
            <CountBadge
              count={unreadCount}
              className="absolute -right-3xs -top-3xs"
              aria-hidden="true"
            />
          </>
        }
      />
    );
  }

  return (
    <>
      <IconButton
        href="/messages"
        label={label}
        aria-current={active ? "page" : undefined}
        appearance="ghost"
        className={cn(
          "relative shrink-0 hover:bg-surface-2 hover:text-foreground md:hidden",
          active && "bg-surface-2 text-foreground"
        )}
        icon={
          <>
            <IconMessages size={20} stroke={1.75} aria-hidden="true" />
            <CountBadge
              count={unreadCount}
              className="absolute -right-3xs -top-3xs"
              aria-hidden="true"
            />
          </>
        }
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
              <IconButton
                label={label}
                aria-current={active ? "page" : undefined}
                appearance="ghost"
                className={triggerClass}
                icon={
                  <>
                    <IconMessages size={20} stroke={1.75} aria-hidden="true" />
                    <CountBadge
                      count={unreadCount}
                      className="absolute -right-3xs -top-3xs"
                      aria-hidden="true"
                    />
                  </>
                }
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
