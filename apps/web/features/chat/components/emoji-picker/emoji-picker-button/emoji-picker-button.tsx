"use client";

import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { Popover } from "@base-ui/react/popover";
import { IconMoodSmile } from "@tabler/icons-react";
import {
  type ReactElement,
  type ReactNode,
  forwardRef,
  useState,
} from "react";
import { EmojiPicker } from "../emoji-picker";

export interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  label: string;
  className?: string;
  children?: ReactNode;
  trigger?: ReactElement;
  disabled?: boolean;
}

/** Self-contained popover trigger for the grouped/searchable emoji panel. */
export const EmojiPickerButton = forwardRef<
  HTMLButtonElement,
  EmojiPickerButtonProps
>(function EmojiPickerButton(
  { onSelect, label, className, children, trigger: triggerElement, disabled = false },
  ref
) {
  const [open, setOpen] = useState(false);
  const triggerControl =
    triggerElement ? (
      <Tooltip label={label} positionerClassName="z-50">
        <Popover.Trigger
          ref={ref}
          aria-label={label}
          disabled={disabled}
          render={triggerElement}
        />
      </Tooltip>
    ) : (
      <Popover.Trigger
        render={
          <IconButton
            ref={ref}
            label={label}
            appearance="ghost"
            disabled={disabled}
            tooltip
            className={className}
            icon={
              children ?? (
                <IconMoodSmile size={20} stroke={1.75} aria-hidden="true" />
              )
            }
          />
        }
      />
    );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {triggerControl}
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="end"
          sideOffset={4}
          className="z-20"
        >
          {/* Keep focus on the trigger at open — autofocusing the search
              field flashes a focus ring on every open and pops the mobile
              keyboard over the grid. Tab reaches the field in one step. */}
          <Popover.Popup initialFocus={false}>
            <EmojiPicker
              onSelect={(emoji) => {
                onSelect(emoji);
                setOpen(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
});
