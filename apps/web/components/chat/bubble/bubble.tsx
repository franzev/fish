import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface BubbleProps extends HTMLAttributes<HTMLDivElement> {
  /** Sent (true) vs received (false). Not a color prop — the visual
   *  distinction is derived from this single boolean. */
  mine: boolean;
}

/** The message bubble shell. Sent = inverted primary block (the message's
 *  own emphasis, not a competing primary *button* — the single-primary-
 *  action rule governs action buttons, and the one action button is Send in
 *  ChatInput). Received = plain surface with a border. Both share
 *  `rounded-card` with one corner squared off for the speech-bubble tail. */
export const Bubble = forwardRef<HTMLDivElement, BubbleProps>(
  ({ mine, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "animate-message-in inline-block max-w-message rounded-card px-4 py-2.5 text-ui break-words",
          mine
            ? "rounded-br-control bg-primary text-on-primary"
            : "rounded-bl-control border border-border bg-surface text-body",
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
