"use client";

import { EmojiPickerButton } from "../emoji-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  IconGif,
  IconMoodSmile,
  IconSend,
  IconSticker,
} from "@tabler/icons-react";
import type { KeyboardEvent } from "react";
import { AddMenu } from "./add-menu";
import { composerIconButtonClass } from "./icon-button-class";

export interface ComposerProps {
  /** Community channel name for the placeholder; direct chats omit it. */
  channelName?: string;
  draft: string;
  canSend: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  onSelectEmoji: (emoji: string) => void;
}

/** The message composer: one borderless surface-2 bar holding every input
 *  affordance. The Send button only exists while there is something to send
 *  — with an empty draft the bar has no primary action at all, keeping the
 *  one-primary-action rule intact for the whole screen. GIFs, stickers,
 *  uploads, audio recording, and polls aren't built yet; those controls stay
 *  visible but inert rather than raising an alert. */
export function Composer({
  channelName,
  draft,
  canSend,
  onDraftChange,
  onSend,
  onKeyDown,
  onBlur,
  onSelectEmoji,
}: ComposerProps) {
  return (
    <div className="p-sm">
      {/* Accessibility floor: the textarea carries no border or ring of its
          own (explicit design decision), so the visible keyboard-focus
          indicator moves to the bar via focus-within — a thinner, dimmed
          1px focus-outer/60 outline (vs. the global solid 2px
          :focus-visible rule) to stay unobtrusive on this dense control
          bar while still being visible. */}
      <div
        className={cn(
          "flex items-end gap-xs rounded-control bg-surface-2 p-xs",
          "focus-within:outline-1 focus-within:outline-offset-2 focus-within:outline-focus-outer/60"
        )}
      >
        <AddMenu />
        <textarea
          aria-label="Message"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          rows={1}
          enterKeyHint="send"
          placeholder={channelName ? `Message #${channelName}` : "Message"}
          className="min-h-control flex-1 resize-none border-none bg-transparent px-xs py-field-y text-copy text-foreground outline-none placeholder:text-muted focus-visible:shadow-none focus-visible:outline-none"
        />
        <button
          type="button"
          aria-label="Add a GIF"
          className={composerIconButtonClass}
        >
          <IconGif size={20} stroke={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Add a sticker"
          className={composerIconButtonClass}
        >
          <IconSticker size={20} stroke={1.75} aria-hidden="true" />
        </button>
        <EmojiPickerButton
          label="Add an emoji"
          onSelect={onSelectEmoji}
          className={composerIconButtonClass}
        >
          <IconMoodSmile size={20} stroke={1.75} aria-hidden="true" />
        </EmojiPickerButton>
        {canSend && (
          <Button
            type="button"
            fullWidth={false}
            onClick={onSend}
            className="shrink-0 px-md"
            aria-label="Send message"
          >
            <IconSend size={20} stroke={1.75} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
