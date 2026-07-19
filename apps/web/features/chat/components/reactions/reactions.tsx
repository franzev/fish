"use client";

import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { IconMoodPlus } from "@tabler/icons-react";
import { HTMLAttributes } from "react";
import { EmojiPickerButton } from "../emoji-picker";
import { ReactionPill } from "../reaction-pill";
import type { Reaction } from "../types";

interface ReactionsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onToggle"> {
  reactions?: Reaction[];
  onToggle?: (emoji: string) => void;
  disabled?: boolean;
}

/** A row of emoji-count pills, plus a trailing circular add-reaction pill
 *  (screenshot geometry) that opens the grouped emoji picker. The viewer's
 *  own reaction (`byMe`) is marked with a heavier tone, never a color hue.
 *  Renders nothing for an empty/missing list — the hover-bar smiley handles
 *  a message's first reaction, so there is no empty pill row taking up
 *  space. */
export function Reactions({
  reactions,
  onToggle,
  disabled = false,
  className,
  ...props
}: ReactionsProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2xs", className)} {...props}>
        {reactions.map((reaction) => {
          const label = `${reaction.emoji} reaction, ${reaction.count} ${
            reaction.count === 1 ? "person" : "people"
          }${reaction.byMe ? ", including you" : ""}`;

          return (
            <Tooltip key={reaction.emoji} label={label}>
              <ReactionPill
                aria-label={label}
                aria-pressed={reaction.byMe}
                disabled={disabled}
                onClick={() => onToggle?.(reaction.emoji)}
                selected={reaction.byMe}
                className="md:animate-reaction-pop"
              >
                <span className="inline-flex items-center gap-2xs max-md:animate-reaction-pop">
                  <span aria-hidden="true" className="text-ui-sm leading-none">
                    {reaction.emoji}
                  </span>
                  <span className="text-ui-xs font-medium leading-none">
                    {reaction.count}
                  </span>
                </span>
              </ReactionPill>
            </Tooltip>
          );
        })}
        {onToggle && !disabled && (
          <EmojiPickerButton
            label="Add a reaction"
            onSelect={(emoji) => onToggle(emoji)}
            trigger={
              <ReactionPill className="justify-center text-muted hover:text-body">
                <IconMoodPlus size={18} stroke={1.75} aria-hidden="true" />
              </ReactionPill>
            }
          />
        )}
    </div>
  );
}
