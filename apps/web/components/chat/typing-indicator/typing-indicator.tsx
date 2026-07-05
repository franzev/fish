import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

const DOT_DELAY_TOKENS = [
  "--duration-typing-delay-none",
  "--duration-typing-delay-short",
  "--duration-typing-delay-long",
];

/** Three dots, staggered via the shared `animate-typing` keyframe (each dot
 *  gets its own inline animation-delay). `role="status"` + label announces
 *  "typing" once instead of a screen reader looping through three spans.
 *  Under prefers-reduced-motion the global rule clamps the animation
 *  duration to near-zero — the dots simply hold still, no error. */
export function TypingIndicator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="typing"
      className={cn("flex items-center gap-1 rounded-pill bg-surface-2 px-3 py-2", className)}
      {...props}
    >
      {DOT_DELAY_TOKENS.map((delayToken) => (
        <span
          key={delayToken}
          aria-hidden="true"
          className="size-1.5 animate-typing rounded-pill bg-muted"
          style={{ animationDelay: `var(${delayToken})` }}
        />
      ))}
    </div>
  );
}
