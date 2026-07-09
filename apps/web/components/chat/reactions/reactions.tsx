"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";
import { EmojiPickerButton } from "../emoji-picker";
import type { Reaction } from "../types";

interface ReactionsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onToggle"> {
  reactions?: Reaction[];
  onToggle?: (emoji: string) => void;
}

/** A row of emoji-count pills, plus a trailing circular add-reaction pill
 *  (screenshot geometry) that opens the grouped emoji picker. The viewer's
 *  own reaction (`byMe`) is marked with a heavier tone, never a color hue.
 *  Renders nothing for an empty/missing list — the hover-bar smiley handles
 *  a message's first reaction, so there is no empty pill row taking up
 *  space. */
export function Reactions({ reactions, onToggle, className, ...props }: ReactionsProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2xs", className)} {...props}>
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
            // under the message, not a full-height control. Borderless —
            // the viewer's own reaction (byMe) reads by a heavier fill step
            // on the monochrome ladder, never a border or color hue.
            "animate-reaction-pop inline-flex items-center gap-2xs rounded-pill px-xs py-2xs transition-colors",
            reaction.byMe
              ? "bg-surface-3 text-foreground"
              : "bg-surface-2 text-body hover:bg-surface-3"
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
      {onToggle && (
        <EmojiPickerButton
          label="Add a reaction"
          onSelect={(emoji) => onToggle(emoji)}
          className="inline-flex items-center justify-center rounded-pill bg-surface-2 px-xs py-2xs text-muted transition-colors hover:bg-surface-3 hover:text-body"
        />
      )}
    </div>
  );
}
