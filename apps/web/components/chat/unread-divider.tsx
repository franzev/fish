import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

/** A quiet horizontal rule marking the boundary between read and unread
 *  messages. Structural weight only — never an alarming color. */
export function UnreadDivider({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      aria-label="Unread messages"
      className={cn("my-3 flex items-center gap-3", className)}
      {...props}
    >
      <span className="h-px flex-1 bg-border-strong" />
      <span className="text-[13px] font-medium text-muted">New</span>
      <span className="h-px flex-1 bg-border-strong" />
    </div>
  );
}
