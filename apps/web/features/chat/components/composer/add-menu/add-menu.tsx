"use client";

import {
  ActionMenuItem,
  ActionMenuPopup,
  ActionMenuRoot,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import { IconButton } from "@/components/ui/icon-button";
import {
  IconChartBar,
  IconMicrophone,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";
import { useRef, type ChangeEvent } from "react";

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
    <ActionMenuRoot>
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
      <ActionMenuTrigger
        render={
          <IconButton
            label="Add to message"
            appearance="ghost"
            disabled={disabled}
            className="shrink-0 hover:bg-surface-3"
            icon={<IconPlus size={20} stroke={1.75} aria-hidden="true" />}
          />
        }
      />
      <ActionMenuPopup side="top" align="start" positionerClassName="z-20">
            <ActionMenuItem onClick={() => inputRef.current?.click()}>
              <IconUpload size={20} stroke={1.75} aria-hidden="true" />
              Add files
            </ActionMenuItem>
            <ActionMenuItem>
              <IconMicrophone size={20} stroke={1.75} aria-hidden="true" />
              Audio recording
            </ActionMenuItem>
            <ActionMenuItem>
              <IconChartBar size={20} stroke={1.75} aria-hidden="true" />
              Create poll
            </ActionMenuItem>
      </ActionMenuPopup>
    </ActionMenuRoot>
  );
}
