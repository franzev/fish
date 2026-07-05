"use client";

import { cn } from "@/lib/utils";
import { IconDots, IconInfoCircle, IconPhone } from "@tabler/icons-react";
import { HTMLAttributes } from "react";
import { Avatar } from "../avatar";
import { PresenceIndicator } from "../presence-indicator";
import type { ChatParticipantView } from "../types";

interface ChatHeaderProps extends HTMLAttributes<HTMLDivElement> {
  participant: ChatParticipantView;
  onCall?: () => void;
  onInfo?: () => void;
  onMenu?: () => void;
}

/** One row: participant avatar + name + presence, and ghost icon actions
 *  (call/info/menu). None of these are primary actions — the single
 *  primary in the composed chat view is Send, in ChatInput. */
export function ChatHeader({
  participant,
  onCall,
  onInfo,
  onMenu,
  className,
  ...props
}: ChatHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border bg-surface px-4 py-3",
        className
      )}
      {...props}
    >
      <Avatar name={participant.name} src={participant.avatarUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-ui-md font-medium text-foreground">{participant.name}</p>
        <PresenceIndicator online={participant.online} />
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Call"
          onClick={onCall}
          className="flex min-h-control min-w-control items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-body"
        >
          <IconPhone size={20} stroke={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Conversation info"
          onClick={onInfo}
          className="flex min-h-control min-w-control items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-body"
        >
          <IconInfoCircle size={20} stroke={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="More options"
          onClick={onMenu}
          className="flex min-h-control min-w-control items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-body"
        >
          <IconDots size={20} stroke={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
