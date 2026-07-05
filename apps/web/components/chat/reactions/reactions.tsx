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
    <div className={cn("flex flex-wrap gap-1.5", className)} {...props}>
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
            "animate-reaction-pop inline-flex min-h-control items-center gap-1 rounded-pill border px-4 text-ui-xs transition-colors",
            reaction.byMe
              ? "border-border-strong bg-surface-2 text-foreground"
              : "border-border bg-surface text-body hover:bg-surface-2"
          )}
        >
          <span aria-hidden="true">{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
