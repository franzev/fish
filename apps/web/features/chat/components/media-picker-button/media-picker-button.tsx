"use client";

import { IconButton } from "@/components/ui/icon-button";
import type { GifProvider } from "@/features/chat/model/gif-provider";
import type { ClientChatGif } from "@/lib/services";
import { useMobileLayout } from "@/hooks/use-mobile-layout";
import { Popover } from "@base-ui/react/popover";
import { IconMoodSmile } from "@tabler/icons-react";
import { forwardRef, useRef, useState, type ReactNode } from "react";
import { MediaPicker, type MediaPickerTab } from "../media-picker";
import type { ChatSticker } from "../sticker-picker";

export interface MediaPickerButtonProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gif: ClientChatGif, query: string) => void;
  onSelectSticker: (sticker: ChatSticker) => void;
  defaultTab?: MediaPickerTab;
  gifDisabled?: boolean;
  stickerDisabled?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  gifProvider?: GifProvider;
}

/** The composer's single expression trigger. Base UI owns focus return,
 * collision handling, Escape, and outside-click dismissal. */
export const MediaPickerButton = forwardRef<
  HTMLButtonElement,
  MediaPickerButtonProps
>(function MediaPickerButton(
  {
    onSelectEmoji,
    onSelectGif,
    onSelectSticker,
    defaultTab,
    gifDisabled,
    stickerDisabled,
    disabled,
    className,
    children,
    gifProvider,
  },
  ref
) {
  const [open, setOpen] = useState(false);
  const mobile = useMobileLayout();
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeAfter = <Args extends unknown[]>(
    callback: (...args: Args) => void
  ) => (...args: Args) => {
    callback(...args);
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={setOpen}
      modal={mobile ? "trap-focus" : false}
    >
      <Popover.Trigger
        render={
          <IconButton
            ref={ref}
            label="Add emoji, GIF, or sticker"
            appearance="ghost"
            disabled={disabled}
            data-slot="media-picker-trigger"
            className={className}
            icon={children ?? <IconMoodSmile size={20} stroke={1.75} aria-hidden="true" />}
          />
        }
      />
      <Popover.Portal>
        <Popover.Backdrop className="fixed inset-0 z-40 hidden bg-scrim max-md:block" />
        <Popover.Positioner
          side="top"
          align="end"
          sideOffset={4}
          className="media-picker-positioner z-50"
        >
          <Popover.Popup
            initialFocus={mobile ? closeRef : false}
            role="presentation"
          >
            <MediaPicker
              defaultTab={defaultTab}
              gifDisabled={gifDisabled}
              stickerDisabled={stickerDisabled}
              gifProvider={gifProvider}
              onClose={() => setOpen(false)}
              closeButtonRef={closeRef}
              onSelectEmoji={closeAfter(onSelectEmoji)}
              onSelectGif={closeAfter(onSelectGif)}
              onSelectSticker={closeAfter(onSelectSticker)}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
});
