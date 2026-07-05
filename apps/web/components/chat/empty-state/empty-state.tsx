import { cn } from "@/lib/utils";
import { IconMessageCircle } from "@tabler/icons-react";
import { HTMLAttributes } from "react";

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
}

/** A calm centered message for an empty conversation. Voice-appropriate,
 *  never scolding — this is a beginning, not a lack of something. */
export function EmptyState({
  title = "No messages yet",
  description = "Say hello to get things started.",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      <IconMessageCircle size={32} stroke={1.5} aria-hidden="true" className="text-muted" />
      <p className="text-copy font-medium text-foreground">{title}</p>
      <p className="text-ui text-muted">{description}</p>
    </div>
  );
}
