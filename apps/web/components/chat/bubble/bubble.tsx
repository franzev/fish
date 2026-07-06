import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface BubbleProps extends HTMLAttributes<HTMLDivElement> {
  /** Sent (true) vs received (false). Not a color prop — the visual
   *  distinction is derived from this single boolean. */
  mine: boolean;
  groupedWithPrevious?: boolean;
  groupedWithNext?: boolean;
}

interface BubbleRadiusOptions {
  mine: boolean;
  groupedWithPrevious?: boolean;
  groupedWithNext?: boolean;
}

export function getBubbleRadiusClasses({
  mine,
  groupedWithPrevious = false,
  groupedWithNext = false,
}: BubbleRadiusOptions) {
  if (mine) {
    return cn(
      "rounded-tl-chat rounded-bl-chat",
      groupedWithPrevious ? "rounded-tr-chat-inner" : "rounded-tr-chat",
      groupedWithNext || (!groupedWithPrevious && !groupedWithNext)
        ? "rounded-br-chat-inner"
        : "rounded-br-chat"
    );
  }

  return cn(
    "rounded-tr-chat rounded-br-chat",
    groupedWithPrevious ? "rounded-tl-chat-inner" : "rounded-tl-chat",
    groupedWithNext || (!groupedWithPrevious && !groupedWithNext)
      ? "rounded-bl-chat-inner"
      : "rounded-bl-chat"
  );
}

/** The message bubble shell. Sent = inverted primary block (the message's
 *  own emphasis, not a competing primary *button* — the single-primary-
 *  action rule governs action buttons, and the one action button is Send in
 *  ChatInput). Received = plain surface. Consecutive messages tighten the
 *  touching corners so a run reads as one connected stack. */
export const Bubble = forwardRef<HTMLDivElement, BubbleProps>(
  (
    {
      mine,
      groupedWithPrevious = false,
      groupedWithNext = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "animate-message-in inline-block max-w-message px-md py-compact text-ui break-words",
          getBubbleRadiusClasses({ mine, groupedWithPrevious, groupedWithNext }),
          mine ? "bg-primary text-on-primary" : "bg-surface text-body",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Bubble.displayName = "Bubble";
