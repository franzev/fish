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
      className={cn("mb-2xs flex items-baseline gap-xs text-muted", className)}
      {...props}
    >
      {/* Sizes live on the leaf elements: twMerge has no font-size group for
          the custom text-ui-* scale, so a size on the cn() container is
          swallowed by the text color class. Name reads at the message body
          size; the timestamp stays a quiet caption beside it. */}
      <span className="text-ui-sm font-medium leading-none text-body">{authorName}</span>
      {tag && (
        <span className="rounded-pill bg-surface-2 px-xs text-ui-2xs font-medium text-body">
          {tag}
        </span>
      )}
      {/* Time text is locale/timezone-dependent, so server-prerendered and
          client-hydrated output can differ. Suppress the hydration warning on
          this leaf — the machine-readable dateTime attribute stays stable. */}
      <time
        className="text-ui-xs"
        dateTime={typeof sentAt === "string" ? sentAt : sentAt.toISOString()}
        suppressHydrationWarning
      >
        {formatTimeOfDay(sentAt, timeFormat)}
      </time>
    </div>
  );
}
