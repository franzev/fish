import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface PresenceIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  online?: boolean;
}

/** A small dot, token-colored (never a raw hex traffic-light), with a text
 *  label for screen readers. Presence is quiet, not a badge that competes
 *  with the primary action. */
export function PresenceIndicator({ online, className, ...props }: PresenceIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} {...props}>
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-pill",
          online ? "bg-success" : "bg-muted"
        )}
      />
      <span className="text-[13px] text-muted">{online ? "Online" : "Offline"}</span>
    </span>
  );
}
