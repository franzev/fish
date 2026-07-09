"use client";

import { cn } from "@/lib/utils";
import { Menu } from "@base-ui/react/menu";
import {
  IconChartBar,
  IconMicrophone,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";
import { composerIconButtonClass } from "./icon-button-class";

export interface AddMenuProps {
  onUploadFile: () => void;
  onAudioRecording: () => void;
  onCreatePoll: () => void;
  recording: boolean;
}

const menuItemClass =
  "flex min-h-control items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[highlighted]:bg-surface-2";

/** The composer's + menu — attach-style actions behind one quiet trigger so
 *  the bar itself stays a single line. Base UI Menu supplies the roving
 *  focus, typeahead, Escape/outside dismiss, and focus return. */
export function AddMenu({
  onUploadFile,
  onAudioRecording,
  onCreatePoll,
  recording,
}: AddMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Add to message"
        data-recording={recording || undefined}
        className={cn(
          composerIconButtonClass,
          // Recording is armed from inside this menu, so the trigger carries
          // the on-state fill while a recording is live — surface-3, one step
          // above the bar's own surface-2, per the state-by-fill convention.
          recording && "bg-surface-3 text-foreground"
        )}
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
            <Menu.Item onClick={onUploadFile} className={menuItemClass}>
              <IconUpload size={20} stroke={1.75} aria-hidden="true" />
              Upload File
            </Menu.Item>
            <Menu.Item onClick={onAudioRecording} className={menuItemClass}>
              <IconMicrophone size={20} stroke={1.75} aria-hidden="true" />
              Audio Recording
            </Menu.Item>
            <Menu.Item onClick={onCreatePoll} className={menuItemClass}>
              <IconChartBar size={20} stroke={1.75} aria-hidden="true" />
              Create Poll
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
