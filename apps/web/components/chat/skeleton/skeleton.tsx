import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

/** Shimmer placeholder rows for loading messages. Uses surface tokens only —
 *  the "shimmer" is a plain opacity pulse (silenced under
 *  prefers-reduced-motion by the existing global rule), not a moving
 *  gradient that would need its own reduced-motion guard. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex flex-col gap-sm px-2xs py-xs", className)}
      {...props}
    >
      {[0, 1, 2].map((row) => (
        <div key={row} className={cn("flex gap-xs", row % 2 === 1 ? "flex-row-reverse" : "flex-row")}>
          <div className="size-8 shrink-0 animate-pulse rounded-pill bg-surface-2" />
          <div
            className={cn(
              "h-9 animate-pulse rounded-card bg-surface-2",
              row === 0 ? "w-40" : row === 1 ? "w-52" : "w-32"
            )}
          />
        </div>
      ))}
    </div>
  );
}
