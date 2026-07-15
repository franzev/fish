import { cn } from "@/lib/utils";
import { IconMessageCircle, type Icon } from "@tabler/icons-react";
import type { HTMLAttributes, ReactNode } from "react";

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: Icon;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  appearance?: "plain" | "surface";
  fill?: boolean;
}

/** Calm zero-data guidance with one optional next action. */
export function EmptyState({
  icon: EmptyIcon = IconMessageCircle,
  title = "No messages yet",
  description = "Say hello to get things started.",
  action,
  appearance = "plain",
  fill = true,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-xs px-lg py-2xl text-center",
        fill && "flex-1",
        appearance === "surface" && "rounded-card bg-surface py-xl",
        className
      )}
      {...props}
    >
      <EmptyIcon size={32} stroke={1.5} aria-hidden="true" className="text-muted" />
      {title && <p className="text-copy font-medium text-foreground">{title}</p>}
      {description && <div className="max-w-copy text-ui text-muted">{description}</div>}
      {action && <div className="mt-sm">{action}</div>}
    </div>
  );
}
