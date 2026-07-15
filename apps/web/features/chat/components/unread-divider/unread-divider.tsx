import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import { useId } from "react";

interface UnreadDividerProps extends HTMLAttributes<HTMLDivElement> {
  dateLabel?: string;
}

/** A quiet horizontal rule marking the boundary between read and unread
 * messages. Structural weight only, never an alarming color. */
export function UnreadDivider({
  className,
  dateLabel,
  ...props
}: UnreadDividerProps) {
  const dateDescriptionId = useId();

  return (
    <div
      role="separator"
      aria-label="Unread messages"
      aria-describedby={dateLabel ? dateDescriptionId : undefined}
      className={cn("my-sm flex items-center gap-sm", className)}
      {...props}
    >
      <span aria-hidden="true" className="h-px flex-1 bg-border-strong" />
      <span className="flex items-center gap-xs font-medium text-muted">
        {dateLabel && (
          <>
            <span
              id={dateDescriptionId}
              suppressHydrationWarning
              className="text-ui-2xs"
            >
              {dateLabel}
            </span>
            <span aria-hidden="true" className="text-ui-2xs">
              ·
            </span>
          </>
        )}
        <span className="text-ui-xs">New</span>
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border-strong" />
    </div>
  );
}
