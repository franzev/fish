"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export type AutosaveStatusKind =
  | "idle"
  | "saving"
  | "saved"
  | "resume"
  | "error"
  | "offline";

export const autosaveStatusCopy: Record<Exclude<AutosaveStatusKind, "idle">, string> = {
  saving: "Saving...",
  saved: "Saved",
  resume: "We saved your answers. You can continue when you are ready.",
  error: "That did not save yet. Keep this open and try again.",
  offline: "You are offline. We will save when you are back.",
};

interface AutosaveStatusProps extends HTMLAttributes<HTMLParagraphElement> {
  status?: AutosaveStatusKind;
  statusText?: string;
}

export function AutosaveStatus({
  status = "idle",
  statusText,
  className,
  ...props
}: AutosaveStatusProps) {
  const copy = statusText ?? (status === "idle" ? "" : autosaveStatusCopy[status]);

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "min-h-field-message text-ui-sm leading-normal",
        status === "error" || status === "offline" ? "text-notice" : "text-muted",
        className
      )}
      {...props}
    >
      {copy}
    </p>
  );
}
