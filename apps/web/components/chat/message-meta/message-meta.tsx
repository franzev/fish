import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface MessageMetaProps extends HTMLAttributes<HTMLDivElement> {
  authorName: string;
  sentAt: Date | string;
}

function formatTime(sentAt: Date | string): string {
  const date = typeof sentAt === "string" ? new Date(sentAt) : sentAt;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Username + timestamp caption above a message group. Quiet, muted tokens —
 *  this is metadata, not content. */
export function MessageMeta({ authorName, sentAt, className, ...props }: MessageMetaProps) {
  return (
    <div
      className={cn("mb-1 flex items-baseline gap-2 text-ui-xs text-muted", className)}
      {...props}
    >
      <span className="font-medium text-body">{authorName}</span>
      {/* Time text is locale/timezone-dependent, so server-prerendered and
          client-hydrated output can differ. Suppress the hydration warning on
          this leaf — the machine-readable dateTime attribute stays stable. */}
      <time
        dateTime={typeof sentAt === "string" ? sentAt : sentAt.toISOString()}
        suppressHydrationWarning
      >
        {formatTime(sentAt)}
      </time>
    </div>
  );
}
