import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface NotificationBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  count?: number;
}

/** A count-only pill, never a red dot — feedback stays calm and specific,
 *  never alarming. Caps display at "99+" but the aria-label always states
 *  the real count. Renders nothing at 0/undefined so an empty badge never
 *  takes up space. */
export function NotificationBadge({ count, className, ...props }: NotificationBadgeProps) {
  if (!count || count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);

  return (
    <span
      aria-label={`${count} unread ${count === 1 ? "message" : "messages"}`}
      className={cn(
        "inline-flex min-w-[20px] items-center justify-center rounded-pill bg-primary px-1.5 py-0.5 text-[12px] font-semibold text-on-primary",
        className
      )}
      {...props}
    >
      {display}
    </span>
  );
}
