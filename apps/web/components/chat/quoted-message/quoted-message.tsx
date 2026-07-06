import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface QuotedMessageProps extends HTMLAttributes<HTMLDivElement> {
  authorName: string;
  snippet: string;
}

/** A compact reply/quote preview: leading rail + author + a single-line
 *  truncated snippet of the replied-to message. */
export function QuotedMessage({ authorName, snippet, className, ...props }: QuotedMessageProps) {
  return (
    <div
      className={cn(
        "mb-nudge flex gap-xs rounded-control border-l-4 border-border-strong bg-surface-2 py-nudge pl-compact pr-sm",
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <p className="text-ui-xs font-medium text-body">{authorName}</p>
        <p className="truncate text-ui-xs text-muted">{snippet}</p>
      </div>
    </div>
  );
}
