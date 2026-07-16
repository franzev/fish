"use client";

import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import type { GifProvider } from "@/features/chat/model/gif-provider";
import type { ClientChatGif } from "@/lib/services";
import { Tabs } from "@base-ui/react/tabs";
import { IconX } from "@tabler/icons-react";
import type { Ref } from "react";
import { EmojiPicker } from "../emoji-picker";
import { GifPicker } from "../gif-picker";
import { StickerPicker, type ChatSticker } from "../sticker-picker";

export type MediaPickerTab = "emoji" | "gif" | "sticker";

interface MediaPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gif: ClientChatGif, query: string) => void;
  onSelectSticker: (sticker: ChatSticker) => void;
  defaultTab?: MediaPickerTab;
  gifDisabled?: boolean;
  stickerDisabled?: boolean;
  gifProvider?: GifProvider;
  onClose?: () => void;
  closeButtonRef?: Ref<HTMLButtonElement>;
}

const tabClassName =
  "group flex min-h-target-touch items-center justify-center text-muted disabled:cursor-not-allowed disabled:opacity-50";

const tabLabelClassName =
  "inline-flex items-center gap-2xs rounded-control px-xs py-2xs text-ui-xs group-hover:bg-surface-2 group-data-[active]:bg-surface-2 group-data-[active]:text-foreground";

/** One consistent picker surface for every lightweight expressive medium in
 * the chat composer. Each medium keeps its own search and browsing behavior
 * while the popover, tabs, sizing, scroll treatment, and dismissal stay the
 * same. */
export function MediaPicker({
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  defaultTab = "emoji",
  gifDisabled,
  stickerDisabled,
  gifProvider,
  onClose,
  closeButtonRef,
}: MediaPickerProps) {
  return (
    <Card
      role="dialog"
      aria-label="Choose emoji, GIF, or sticker"
      className="flex h-media-panel-h w-media-panel max-w-search-pop-mobile flex-col overflow-hidden border border-divider p-0"
    >
      {onClose && (
        <div className="flex min-h-control shrink-0 items-center border-b border-divider px-xs md:hidden">
          <p className="flex-1 px-xs text-ui-md font-semibold text-foreground">
            Add to message
          </p>
          <IconButton
            ref={closeButtonRef}
            label="Close expression picker"
            appearance="ghost"
            onClick={onClose}
            icon={<IconX size={20} stroke={1.75} aria-hidden="true" />}
          />
        </div>
      )}
      <Tabs.Root defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List
          aria-label="Expression type"
          className="grid shrink-0 grid-cols-3 border-b border-divider px-xs py-2xs"
        >
          <Tabs.Tab value="emoji" className={tabClassName}>
            <span className={tabLabelClassName}>
              <span aria-hidden="true">😀</span>
              <span>Emoji</span>
            </span>
          </Tabs.Tab>
          <Tabs.Tab value="gif" disabled={gifDisabled} className={tabClassName}>
            <span className={tabLabelClassName}>
              <span aria-hidden="true">🎞️</span>
              <span>GIFs</span>
            </span>
          </Tabs.Tab>
          <Tabs.Tab value="sticker" disabled={stickerDisabled} className={tabClassName}>
            <span className={tabLabelClassName}>
              <span aria-hidden="true">🦀</span>
              <span>Stickers</span>
            </span>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="emoji" className="flex min-h-0 flex-1 flex-col">
          <EmojiPicker embedded onSelect={onSelectEmoji} />
        </Tabs.Panel>
        <Tabs.Panel value="gif" className="flex min-h-0 flex-1 flex-col">
          <GifPicker embedded provider={gifProvider} onSelect={onSelectGif} />
        </Tabs.Panel>
        <Tabs.Panel value="sticker" className="flex min-h-0 flex-1 flex-col">
          <StickerPicker onSelect={onSelectSticker} />
        </Tabs.Panel>
      </Tabs.Root>
    </Card>
  );
}
