"use client";

import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface SegmentedControlProps<T> {
  label: string;
  options: ReadonlyArray<SegmentedControlOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
  shape?: "control" | "pill";
  className?: string;
}

/** A quiet single-choice control whose selected state never changes geometry. */
export function SegmentedControl<T>({
  label,
  options,
  value,
  onValueChange,
  shape = "pill",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-wrap gap-xs", className)}
    >
      {options.map((option) => {
        const selected = Object.is(value, option.value);
        return (
          <button
            key={option.label}
            type="button"
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "min-h-control min-w-control rounded-pill px-sm text-ui-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              shape === "control" && "rounded-control px-md",
              selected
                ? "bg-surface-3 text-foreground"
                : "bg-surface-2 text-body hover:bg-surface-3"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
