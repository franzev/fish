import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface SurfaceHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Shared context row for pages, panels, and popovers. */
export function SurfaceHeader({
  title,
  description,
  leading,
  action,
  className,
}: SurfaceHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-sm border-b border-divider p-md",
        className
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="font-serif text-heading-sm font-semibold text-foreground">
          {title}
        </div>
        {description && <div className="mt-3xs text-ui-xs text-muted">{description}</div>}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2xs">{action}</div>
      )}
    </div>
  );
}
