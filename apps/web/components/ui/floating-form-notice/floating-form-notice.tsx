import { Alert, type AlertProps } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface FloatingFormNoticeProps {
  children?: ReactNode;
  tone?: AlertProps["tone"];
  className?: string;
}

/** Layout-stable auth feedback anchored above its relative form container. */
export function FloatingFormNotice({
  children,
  tone = "notice",
  className,
}: FloatingFormNoticeProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-full mb-md",
        className
      )}
    >
      {children && (
        <Alert tone={tone} className="pointer-events-auto animate-fade-in">
          {children}
        </Alert>
      )}
    </div>
  );
}
