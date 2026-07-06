"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconMoodSmile, IconPaperclip, IconSend } from "@tabler/icons-react";
import { KeyboardEvent, TextareaHTMLAttributes, forwardRef, useState } from "react";

interface ChatInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value?: string;
  onSend?: (value: string) => void;
  onChange?: (value: string) => void;
  onAttach?: () => void;
  onEmoji?: () => void;
}

/** The composed chat input row: text field + emoji + attach + ONE primary
 *  Send button — the single primary action in the composed chat view
 *  (AGENTS.md rule 1). Emoji/attach are ghost/icon affordances, never
 *  competing primaries. Enter submits, Shift+Enter inserts a newline. Send
 *  disables when the trimmed value is empty. */
export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ value, onSend, onChange, onAttach, onEmoji, className, placeholder = "Message", ...props }, ref) => {
    const [internalValue, setInternalValue] = useState("");
    const current = value ?? internalValue;
    const canSend = current.trim().length > 0;

    function setValue(next: string) {
      if (value === undefined) setInternalValue(next);
      onChange?.(next);
    }

    function handleSend() {
      if (!canSend) return;
      onSend?.(current.trim());
      if (value === undefined) setInternalValue("");
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      // Ignore the Enter that confirms an IME candidate (CJK input) — otherwise
      // composing a word sends the half-finished message. Enter only submits
      // once composition is done.
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        handleSend();
      }
    }

    return (
      <div className={cn("flex items-end gap-xs border-t border-border bg-surface p-sm", className)}>
        <button
          type="button"
          aria-label="Add emoji"
          onClick={onEmoji}
          className="flex min-h-control min-w-control shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-body"
        >
          <IconMoodSmile size={20} stroke={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Attach file"
          onClick={onAttach}
          className="flex min-h-control min-w-control shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-body"
        >
          <IconPaperclip size={20} stroke={1.75} aria-hidden="true" />
        </button>
        <textarea
          ref={ref}
          aria-label="Message"
          value={current}
          placeholder={placeholder}
          rows={1}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "min-h-control flex-1 resize-none rounded-control border border-border bg-surface px-md py-field-y",
            "text-copy text-foreground placeholder:text-muted",
            "transition-colors focus:border-primary"
          )}
          {...props}
        />
        <Button
          type="button"
          aria-label="Send message"
          onClick={handleSend}
          disabled={!canSend}
          fullWidth={false}
          className="shrink-0 px-md"
        >
          <IconSend size={20} stroke={1.75} aria-hidden="true" />
        </Button>
      </div>
    );
  }
);
ChatInput.displayName = "ChatInput";
