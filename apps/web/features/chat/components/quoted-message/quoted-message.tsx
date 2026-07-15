import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface QuotedMessageProps extends HTMLAttributes<HTMLDivElement> {
  authorName: string;
  snippet: string;
}

/** A compact reply/quote preview: calm boundary + author + a single-line
 *  truncated snippet of the replied-to message. */
export function QuotedMessage({ authorName, snippet, className, ...props }: QuotedMessageProps) {
  return (
    <div
      className={cn(
        "mb-nudge flex gap-xs rounded-control border border-divider bg-surface-2 px-sm py-nudge",
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
