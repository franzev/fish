"use client";

import { Menu } from "@base-ui/react/menu";
import {
  IconChartBar,
  IconMicrophone,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";
import { useRef, type ChangeEvent } from "react";
import { composerIconButtonClass } from "../icon-button-class";

const menuItemClass =
  "flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[highlighted]:bg-surface-2";

/** The composer's + menu — attach-style actions behind one quiet trigger so
 *  the bar itself stays a single line. Upload, audio recording, and polls
 *  aren't built yet, so the items are inert placeholders rather than
 *  dead-end prompts. Base UI Menu supplies the roving focus, typeahead,
 *  Escape/outside dismiss, and focus return. */
interface AddMenuProps {
  onSelectImages?: (files: File[]) => void;
  disabled?: boolean;
}

export function AddMenu({ onSelectImages = () => undefined, disabled }: AddMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    onSelectImages(Array.from(event.target.files ?? []));
    event.target.value = "";
  };
  return (
    <Menu.Root>
      <input
        ref={inputRef}
        type="file"
        aria-label="Choose files"
        accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,.docx,.xlsx,.pptx"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={handleFiles}
      />
      <Menu.Trigger
        aria-label="Add to message"
        disabled={disabled}
        className={composerIconButtonClass}
      >
        <IconPlus size={20} stroke={1.75} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="top"
          align="start"
          sideOffset={4}
          className="z-20"
        >
          <Menu.Popup className="min-w-menu rounded-card border border-border bg-surface p-3xs shadow-popover">
            <Menu.Item className={menuItemClass} onClick={() => inputRef.current?.click()}>
              <IconUpload size={20} stroke={1.75} aria-hidden="true" />
              Add files
            </Menu.Item>
            <Menu.Item className={menuItemClass}>
              <IconMicrophone size={20} stroke={1.75} aria-hidden="true" />
              Audio Recording
            </Menu.Item>
            <Menu.Item className={menuItemClass}>
              <IconChartBar size={20} stroke={1.75} aria-hidden="true" />
              Create Poll
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
