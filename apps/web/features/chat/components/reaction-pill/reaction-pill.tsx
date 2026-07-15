import { cn } from "@/lib/utils";
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type ReactNode,
} from "react";

export interface ReactionPillProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  selected?: boolean;
}

/** Shared button surface for an emoji reaction and the add-reaction trigger. */
export const ReactionPill = forwardRef<HTMLButtonElement, ReactionPillProps>(
  function ReactionPill(
    { children, selected = false, className, type = "button", ...props },
    ref
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={cn(
          "inline-flex min-h-control items-center gap-2xs rounded-pill px-xs py-2xs text-body transition-colors md:h-reaction-pill md:min-h-reaction-pill md:py-3xs",
          selected
            ? "bg-surface-3 text-foreground"
            : "bg-surface-2 hover:bg-surface-3",
          className
        )}
      >
        {children}
      </button>
    );
  }
);

ReactionPill.displayName = "ReactionPill";
