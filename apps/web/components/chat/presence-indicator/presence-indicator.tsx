import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface PresenceIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  online?: boolean;
  label?: string;
  showOnlineDot?: boolean;
}

/** Presence is quiet, not a badge that competes with the primary action. */
export function PresenceIndicator({
  online,
  label,
  showOnlineDot,
  className,
  ...props
}: PresenceIndicatorProps) {
  const statusLabel = label ?? (online ? "Online" : "Offline");
  const shouldShowOnlineDot = showOnlineDot ?? Boolean(online);

  return (
    <span className={cn("inline-flex items-center gap-nudge", className)} {...props}>
      {shouldShowOnlineDot && (
        <span aria-hidden="true" className="size-2 rounded-pill bg-success" />
      )}
      <span className="text-ui-xs text-muted">{statusLabel}</span>
    </span>
  );
}
