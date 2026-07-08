"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";
import type { Reaction } from "../types";

interface ReactionsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onToggle"> {
  reactions?: Reaction[];
  onToggle?: (emoji: string) => void;
}

/** A row of emoji-count pills. The viewer's own reaction (`byMe`) is marked
 *  with a heavier tone, never a color hue. Renders nothing for an empty/
 *  missing list — no empty pill row taking up space. */
export function Reactions({ reactions, onToggle, className, ...props }: ReactionsProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-nudge", className)} {...props}>
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          aria-label={`${reaction.emoji} reaction, ${reaction.count} ${
            reaction.count === 1 ? "person" : "people"
          }${reaction.byMe ? ", including you" : ""}`}
          aria-pressed={reaction.byMe}
          onClick={() => onToggle?.(reaction.emoji)}
          className={cn(
            // Compact reference geometry: a small emoji+count chip resting
            // under the message, not a full-height control. Border is
            // reserved for the viewer's own reaction (byMe) — the rest read
            // as quiet surface chips until hovered.
            "animate-reaction-pop inline-flex items-center gap-2xs rounded-pill border px-xs py-2xs transition-colors",
            reaction.byMe
              ? "border-border-strong bg-surface-2 text-foreground"
              : "border-transparent bg-surface-2 text-body hover:border-border"
          )}
        >
          {/* Sizes live on the spans, not the button: twMerge has no
              font-size group for the custom text-ui-* scale, so a size on
              the button is swallowed by the text color class above. */}
          <span aria-hidden="true" className="text-ui-sm leading-none">
            {reaction.emoji}
          </span>
          <span className="text-ui-xs font-medium leading-none">
            {reaction.count}
          </span>
        </button>
      ))}
    </div>
  );
}
