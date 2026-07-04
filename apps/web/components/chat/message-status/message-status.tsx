import { cn } from "@/lib/utils";
import { IconCheck, IconChecks, IconClock } from "@tabler/icons-react";
import { HTMLAttributes } from "react";
import type { MessageStatus as MessageStatusValue } from "../types";

interface MessageStatusProps extends HTMLAttributes<HTMLSpanElement> {
  status: MessageStatusValue;
}

const statusLabel: Record<MessageStatusValue, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
};

/** A distinct glyph per delivery state, monochrome except "read" which uses
 *  the same primary-inversion accent as the sole sent-bubble emphasis (not a
 *  new hue). Carries its own aria-label so screen readers announce the
 *  state without relying on icon shape alone. */
export function MessageStatus({ status, className, ...props }: MessageStatusProps) {
  const label = statusLabel[status];
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center text-muted", className)}
      {...props}
    >
      {status === "sending" && (
        <IconClock size={14} stroke={1.75} aria-hidden="true" />
      )}
      {status === "sent" && <IconCheck size={14} stroke={1.75} aria-hidden="true" />}
      {status === "delivered" && (
        <IconChecks size={14} stroke={1.75} aria-hidden="true" />
      )}
      {status === "read" && (
        <IconChecks size={14} stroke={2} aria-hidden="true" className="text-foreground" />
      )}
    </span>
  );
}
