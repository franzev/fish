import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface QuotedMessageProps extends HTMLAttributes<HTMLDivElement> {
  authorName: string;
  snippet: string;
}

/** A compact reply/quote preview: leading accent rail + author + a
 *  single-line-truncated snippet of the replied-to message. */
export function QuotedMessage({ authorName, snippet, className, ...props }: QuotedMessageProps) {
  return (
    <div
      className={cn(
        "mb-1.5 flex gap-2 rounded-control border-l-4 border-border-strong bg-surface-2 py-1.5 pl-2.5 pr-3",
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
