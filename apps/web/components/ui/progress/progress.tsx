import { cn } from "@/lib/utils";
import { HTMLAttributes, useId } from "react";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0-100. Progress is visual, never a grade or score. */
  value: number;
  label?: string;
  labelVisuallyHidden?: boolean;
  density?: "default" | "compact";
}

/** Visual progress uses the primary token. No numbers shouted at the user. */
export function Progress({
  value,
  label,
  labelVisuallyHidden = false,
  density = "default",
  className,
  ...props
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const labelId = useId();
  return (
    <div className={cn("w-full", className)} {...props}>
      {label && (
        <p
          id={labelId}
          className={cn(
            labelVisuallyHidden ? "sr-only" : "mb-xs text-ui-sm text-muted"
          )}
        >
          {label}
        </p>
      )}
      <div
        className={cn(
          "w-full overflow-hidden rounded-pill bg-surface-2",
          density === "compact" ? "h-3xs" : "h-sm"
        )}
        role="progressbar"
        aria-labelledby={label ? labelId : undefined}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        data-density={density}
      >
        <div
          className="h-full rounded-pill bg-primary transition-progress duration-progress"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
