"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HTMLAttributes, useMemo, useState } from "react";
import { Avatar } from "../avatar";
import { NotificationBadge } from "../notification-badge";
import type { ChatParticipantView } from "../types";

export interface ConversationSummary {
  id: string;
  participant: ChatParticipantView;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount?: number;
}

interface ConversationListProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  onSelect?: (id: string) => void;
}

/** The sidebar conversation list: a search field (existing Input) filtering
 *  rows by participant name, each row showing avatar + name + last-message
 *  snippet + timestamp + optional unread badge. Holds its own search state,
 *  so this is a client leaf — the page around it stays a server component. */
export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  className,
  ...props
}: ConversationListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => c.participant.name.toLowerCase().includes(needle));
  }, [conversations, query]);

  return (
    <div className={cn("flex flex-col gap-sm", className)} {...props}>
      <Input
        label="Search conversations"
        placeholder="Search by name"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="px-2xs py-lg text-center text-ui text-muted">No matches</p>
      ) : (
        <div className="flex flex-col gap-2xs">
          {filtered.map((conversation) => {
            const isActive = conversation.id === activeConversationId;
            // A button's aria-label REPLACES the accessible name from its
            // children, so the snippet/timestamp/unread badge inside would be
            // silent for screen readers. Compose them all into one label.
            const unread = conversation.unreadCount ?? 0;
            const rowLabel = [
              `Conversation with ${conversation.participant.name}`,
              unread > 0 ? `${unread} unread` : null,
              conversation.lastMessage,
              conversation.lastMessageAt,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <button
                key={conversation.id}
                type="button"
                aria-label={rowLabel}
                aria-current={isActive || undefined}
                onClick={() => onSelect?.(conversation.id)}
                className={cn(
                  "flex min-h-control w-full items-center gap-sm rounded-control border px-sm py-xs text-left transition-colors",
                  isActive
                    ? "border-border-strong bg-surface-2"
                    : "border-transparent hover:bg-surface-2"
                )}
              >
                <Avatar
                  name={conversation.participant.name}
                  src={conversation.participant.avatarUrl}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ui font-medium text-foreground">
                    {conversation.participant.name}
                  </p>
                  <p className="truncate text-ui-xs text-muted">{conversation.lastMessage}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2xs">
                  <span className="text-ui-2xs text-muted">{conversation.lastMessageAt}</span>
                  <NotificationBadge count={conversation.unreadCount} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
