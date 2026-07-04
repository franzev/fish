import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0-100. Progress is visual, never a grade or score. */
  value: number;
  label?: string;
}

/** Visual progress: a lime fill on a dark track. No numbers shouted at the user. */
export function Progress({ value, label, className, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)} {...props}>
      {label && <p className="mb-2 text-[14px] text-muted">{label}</p>}
      <div
        className="h-3 w-full overflow-hidden rounded-pill bg-surface-2"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-pill bg-primary transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
