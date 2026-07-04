"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";
import { Message } from "./message";
import { Skeleton } from "./skeleton";
import { UnreadDivider } from "./unread-divider";
import type { ChatMessageView } from "./types";

interface MessageListProps extends HTMLAttributes<HTMLDivElement> {
  messages: ChatMessageView[];
  firstUnreadId?: string;
  /** Called when the top sentinel is reached — later phases wire this to an
   *  IntersectionObserver to load older history. Not implemented here. */
  onLoadOlder?: () => void;
  loadingOlder?: boolean;
  onReactionToggle?: (messageId: string, emoji: string) => void;
}

/** The scrollable message region. `role="log"` + aria-label announces new
 *  content politely without re-reading the whole history. Renders an
 *  UnreadDivider immediately before the first unread message and exposes a
 *  top sentinel + onLoadOlder callback for a future infinite-scroll wire-up. */
export function MessageList({
  messages,
  firstUnreadId,
  onLoadOlder,
  loadingOlder = false,
  onReactionToggle,
  className,
  ...props
}: MessageListProps) {
  return (
    <div
      role="log"
      aria-label="Conversation messages"
      // tabIndex makes the scroll region reachable and scrollable by keyboard —
      // a scrollable container with focusable children is not auto-focusable in
      // Chromium, so without this the history can't be scrolled without a mouse.
      tabIndex={0}
      className={cn("flex-1 overflow-y-auto px-4 py-3", className)}
      {...props}
    >
      {/* Top sentinel: a later phase attaches an IntersectionObserver here
          to call onLoadOlder() when it scrolls into view. */}
      <div data-testid="load-older-sentinel" onClick={onLoadOlder} className="h-1 w-full" />
      {loadingOlder && <Skeleton />}
      <div className="flex flex-col gap-2">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const grouped = Boolean(previous && previous.author.id === message.author.id && previous.mine === message.mine);
          return (
            <div key={message.id}>
              {message.id === firstUnreadId && <UnreadDivider />}
              <Message
                message={message}
                grouped={grouped}
                onReactionToggle={onReactionToggle ? (emoji) => onReactionToggle(message.id, emoji) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
