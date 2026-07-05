"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface AnswerChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const AnswerChip = forwardRef<HTMLButtonElement, AnswerChipProps>(
  ({ className, selected = false, type = "button", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={selected}
        className={cn(
          "flex min-h-control w-full items-center rounded-control border px-4 py-3",
          "text-left text-ui transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
          selected
            ? "border-primary bg-surface-2 font-semibold text-foreground rounded-card"
            : "border-border bg-surface font-normal text-body hover:bg-surface-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
AnswerChip.displayName = "AnswerChip";
