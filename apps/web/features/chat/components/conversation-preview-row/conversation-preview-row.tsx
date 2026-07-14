"use client";

import { CountBadge } from "@/components/ui/count-badge";
import { formatTimeOfDay } from "@/lib/prefs/time-format";
import { useTimeFormatPreference } from "@/lib/prefs/use-time-format-preference";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Avatar } from "../avatar";

export interface ConversationPreviewParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface ConversationPreviewRowProps {
  href: string;
  participant: ConversationPreviewParticipant;
  preview: string;
  latestMessageAt?: string | null;
  unreadCount?: number;
  active?: boolean;
  presentation?: "popover" | "rail";
  onNavigate?: () => void;
}

/** Shared direct-conversation preview used in compact popovers and desktop rails. */
export function ConversationPreviewRow({
  href,
  participant,
  preview,
  latestMessageAt = null,
  unreadCount = 0,
  active = false,
  presentation = "popover",
  onNavigate,
}: ConversationPreviewRowProps) {
  const timeFormat = useTimeFormatPreference();
  const latestTime = latestMessageAt
    ? formatTimeOfDay(latestMessageAt, timeFormat)
    : "";

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-control min-w-0 items-start gap-sm transition-colors hover:bg-surface-2",
        presentation === "rail"
          ? "rounded-control p-xs text-body hover:bg-surface-3"
          : "px-md py-md",
        active && presentation === "rail" && "bg-surface-2"
      )}
    >
      <Avatar
        profileId={participant.id}
        src={participant.avatarUrl ?? undefined}
        name={participant.displayName}
        size="md"
        alt=""
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-xs">
          <span className="truncate text-ui font-semibold text-foreground">
            {participant.displayName}
          </span>
          {latestTime && (
            <time dateTime={latestMessageAt ?? undefined} className="shrink-0 text-ui-2xs text-muted">
              {latestTime}
            </time>
          )}
        </span>
        <span className="mt-2xs flex items-center gap-xs">
          <span className="min-w-0 flex-1 truncate text-ui-sm text-muted">
            {preview}
          </span>
          <CountBadge count={unreadCount} aria-label={`${unreadCount} unread`} />
        </span>
      </span>
    </Link>
  );
}
