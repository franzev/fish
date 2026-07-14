"use client";

import { Button } from "@/components/ui/button";
import { formatTimeOfDay } from "@/lib/prefs/time-format";
import { useTimeFormatPreference } from "@/lib/prefs/use-time-format-preference";
import { IconChecks } from "@tabler/icons-react";

export interface UnreadMessageBannerProps {
  count: number;
  oldestUnreadAt: string | null;
  loading?: boolean;
  notice?: string | null;
  onMarkRead: () => void | Promise<void>;
}

export function UnreadMessageBanner({
  count,
  oldestUnreadAt,
  loading = false,
  notice = null,
  onMarkRead,
}: UnreadMessageBannerProps) {
  const timeFormat = useTimeFormatPreference();
  const oldestUnreadTime = oldestUnreadAt
    ? formatTimeOfDay(oldestUnreadAt, timeFormat)
    : "";
  const messageLabel = count === 1 ? "new message" : "new messages";

  if (count <= 0) {
    return null;
  }

  return (
    <section
      aria-label="Unread messages"
      className="absolute inset-x-0 top-0 z-10 mx-md rounded-b-control bg-surface-2 px-sm"
    >
      <div className="flex min-h-control flex-wrap items-center justify-between gap-2xs sm:min-h-search-control">
        <p
          aria-live="polite"
          className="text-ui-xs font-semibold text-foreground"
        >
          {count} {messageLabel}
          {oldestUnreadTime ? ` since ${oldestUnreadTime}` : ""}
        </p>
        <Button
          type="button"
          variant="ghost"
          loading={loading}
          onClick={() => void onMarkRead()}
          className="shrink-0 px-xs text-ui-xs font-medium sm:min-h-search-control"
        >
          <span className="inline-flex items-center gap-3xs">
            Mark as read
            <IconChecks size={16} stroke={1.75} aria-hidden="true" />
          </span>
        </Button>
      </div>
      {notice && (
        <p role="status" className="mt-3xs pb-2xs text-ui-xs text-notice">
          {notice}
        </p>
      )}
    </section>
  );
}
