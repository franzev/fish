import { cn } from "@/lib/utils";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export interface CountBadgeProps extends ComponentPropsWithoutRef<"span"> {
  count: number;
  max?: number;
  prefix?: string;
}

/** Compact count indicator with stable height and content-aware pill width. */
export const CountBadge = forwardRef<HTMLSpanElement, CountBadgeProps>(
  function CountBadge(
    { className, count, max = 99, prefix = "", ...props },
    ref
  ) {
    if (count <= 0) return null;

    const displayCount = count > max ? `${max}+` : count;

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex min-w-badge shrink-0 items-center justify-center rounded-pill bg-primary px-3xs py-3xs text-ui-3xs font-semibold text-on-primary",
          className
        )}
        {...props}
      >
        {prefix}{displayCount}
      </span>
    );
  }
);
