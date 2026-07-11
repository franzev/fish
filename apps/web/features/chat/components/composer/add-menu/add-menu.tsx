"use client";

import { Menu } from "@base-ui/react/menu";
import {
  IconChartBar,
  IconMicrophone,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";
import { composerIconButtonClass } from "../icon-button-class";

const menuItemClass =
  "flex min-h-control cursor-pointer items-center gap-sm rounded-control px-sm text-ui-sm text-foreground data-[highlighted]:bg-surface-2";

/** The composer's + menu — attach-style actions behind one quiet trigger so
 *  the bar itself stays a single line. Upload, audio recording, and polls
 *  aren't built yet, so the items are inert placeholders rather than
 *  dead-end prompts. Base UI Menu supplies the roving focus, typeahead,
 *  Escape/outside dismiss, and focus return. */
export function AddMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Add to message"
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
            <Menu.Item className={menuItemClass}>
              <IconUpload size={20} stroke={1.75} aria-hidden="true" />
              Upload File
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
