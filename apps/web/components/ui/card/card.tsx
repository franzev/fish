import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

/** A calm container. The basic surface everything sits on. Elevation is a
 *  light-dark() token — soft shadow in light theme, none in dark theme
 *  (dark relies on the surface lightness-step instead). No theme-variant
 *  branching in this component. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card bg-surface p-6 border border-border",
        "shadow-[var(--shadow-card)]",
        className
      )}
      {...props}
    />
  );
}
