import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

/** A calm container separated from the canvas by its surface step. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card bg-surface p-md", className)}
      {...props}
    />
  );
}
