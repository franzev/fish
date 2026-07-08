"use client";

import {
  formatTimeOfDay,
  useTimeFormatPreference,
} from "@/lib/prefs/time-format";
import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface MessageMetaProps extends HTMLAttributes<HTMLDivElement> {
  authorName: string;
  sentAt: Date | string;
  /** Optional role tag ("Coach") rendered as a quiet monochrome pill —
   *  hierarchy before color, so roles read by shape, not hue. */
  tag?: string;
}

/** Username + timestamp caption above a message group. Quiet, muted tokens —
 *  this is metadata, not content. */
export function MessageMeta({ authorName, sentAt, tag, className, ...props }: MessageMetaProps) {
  const timeFormat = useTimeFormatPreference();

  return (
    <div
      className={cn("mb-2xs flex items-baseline gap-xs text-ui-xs text-muted", className)}
      {...props}
    >
      <span className="font-medium text-body">{authorName}</span>
      {tag && (
        <span className="rounded-pill bg-surface-2 px-xs text-ui-2xs font-medium text-body">
          {tag}
        </span>
      )}
      {/* Time text is locale/timezone-dependent, so server-prerendered and
          client-hydrated output can differ. Suppress the hydration warning on
          this leaf — the machine-readable dateTime attribute stays stable. */}
      <time
        dateTime={typeof sentAt === "string" ? sentAt : sentAt.toISOString()}
        suppressHydrationWarning
      >
        {formatTimeOfDay(sentAt, timeFormat)}
      </time>
    </div>
  );
}
