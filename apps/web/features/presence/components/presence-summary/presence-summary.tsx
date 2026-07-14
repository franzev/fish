"use client";

import { cn } from "@/lib/utils";
import { usePresence } from "../presence-provider";
import { PresenceIndicator } from "../presence-indicator";

interface PresenceSummaryProps {
  userId: string;
  showLastSeen?: boolean;
  className?: string;
}

export function PresenceSummary({
  userId,
  showLastSeen = false,
  className,
}: PresenceSummaryProps) {
  const presence = usePresence(userId);
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-nudge text-ui-sm text-muted",
        className
      )}
    >
      <PresenceIndicator status={presence.status} />
      <span className="truncate">
        {presence.label}
        {showLastSeen && presence.detail ? ` · ${presence.detail}` : ""}
      </span>
    </span>
  );
}
