"use client";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  IconMoodSmile,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { useState, type DragEvent, type KeyboardEvent } from "react";
import { AddMenu } from "./add-menu";
import { composerIconButtonClass } from "./icon-button-class";
import type { PendingChatImage } from "@/features/chat/hooks/use-chat-image-uploads";
import { ImageUploadPreview } from "./image-upload-preview";
import type { ClientChatGif } from "@/lib/services";
import { GifSelectionPreview } from "../gif-selection-preview";
import { MediaPickerButton } from "../media-picker";
import type { ChatSticker } from "../sticker-picker";
import type { ChatStickerId } from "@fish/core/chat";
import { StickerMedia } from "../sticker-media";

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
  images?: PendingChatImage[];
  onSelectImages?: (files: File[]) => void;
  onRemoveImage?: (clientUploadId: string) => void;
  onRetryImage?: (clientUploadId: string) => void;
  imageSelectionDisabled?: boolean;
  selectedGif?: ClientChatGif | null;
  onSelectGif?: (gif: ClientChatGif, query: string) => void;
  onRemoveGif?: () => void;
  gifSelectionDisabled?: boolean;
  onSelectSticker?: (sticker: ChatSticker) => void;
  selectedStickerId?: ChatStickerId | null;
  onRemoveSticker?: () => void;
  stickerSelectionDisabled?: boolean;
}

function getSendDisabledReason(images: PendingChatImage[]): string | null {
  if (images.some((image) => image.status === "failed")) {
    return "Retry or remove the upload that didn't finish";
  }

  const pending = images.filter((image) => image.status !== "ready");
  if (pending.length === 0) return null;

  const subject = pending.length > 1
    ? "files"
    : pending[0]?.kind === "image"
      ? "photo"
      : "file";

  if (pending.some((image) => image.status === "preparing")) {
    return `Still preparing your ${subject}`;
  }
  if (pending.some((image) => image.status === "uploading")) {
    return `Still uploading your ${subject}`;
  }

  return `Still finishing your ${subject}`;
}

/** The message composer: one borderless surface-2 bar holding every input
 *  affordance. The Send button only exists while there is something to send
 *  — with an empty draft the bar has no primary action at all, keeping the
 *  one-primary-action rule intact for the whole screen. */
export function Composer({
  channelName,
  draft,
  canSend,
  onDraftChange,
  onSend,
  onKeyDown,
  onBlur,
  onSelectEmoji,
  images = [],
  onSelectImages = () => undefined,
  onRemoveImage = () => undefined,
  onRetryImage = () => undefined,
  imageSelectionDisabled,
  selectedGif,
  onSelectGif = () => undefined,
  onRemoveGif = () => undefined,
  gifSelectionDisabled,
  onSelectSticker = () => undefined,
  selectedStickerId,
  onRemoveSticker = () => undefined,
  stickerSelectionDisabled,
}: ComposerProps) {
  const [dragActive, setDragActive] = useState(false);
  const hasSendContent =
    draft.trim().length > 0
    || images.length > 0
    || Boolean(selectedGif)
    || Boolean(selectedStickerId);
  const sendDisabledReason = !canSend ? getSendDisabledReason(images) : null;
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (!imageSelectionDisabled) onSelectImages(Array.from(event.dataTransfer.files));
  };
  return (
    <div
      className="relative p-sm"
      onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <div className="rounded-control bg-surface-2">
        <ImageUploadPreview images={images} onRemove={onRemoveImage} onRetry={onRetryImage} />
        {selectedStickerId && (
          <div className="relative w-fit px-xs pt-xs">
            <StickerMedia stickerId={selectedStickerId} />
            <button
              type="button"
              aria-label="Remove sticker"
              onClick={onRemoveSticker}
              className="absolute right-3xs top-3xs inline-flex min-h-control min-w-control items-start justify-end rounded-control p-2xs text-body"
            >
              <span className="inline-flex size-md items-center justify-center rounded-pill bg-surface">
                <IconX size={16} stroke={1.75} aria-hidden="true" />
              </span>
            </button>
          </div>
        )}
        {selectedGif && <GifSelectionPreview gif={selectedGif} onRemove={onRemoveGif} />}
        <div className="flex items-end gap-xs p-xs">
        <AddMenu onSelectImages={onSelectImages} disabled={imageSelectionDisabled} />
        <textarea
          aria-label="Message"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          rows={1}
          enterKeyHint="send"
          placeholder={channelName ? `Message #${channelName}` : "Message"}
          className="min-h-control flex-1 resize-none border-none bg-transparent px-xs py-field-y text-copy text-foreground outline-none placeholder:text-muted focus-visible:bg-transparent"
        />
        <MediaPickerButton
          onSelectEmoji={onSelectEmoji}
          onSelectGif={onSelectGif}
          onSelectSticker={onSelectSticker}
          gifDisabled={gifSelectionDisabled}
          stickerDisabled={stickerSelectionDisabled}
          className={composerIconButtonClass}
        >
          <IconMoodSmile size={20} stroke={1.75} aria-hidden="true" />
        </MediaPickerButton>
        {hasSendContent && (
          <Tooltip.Provider delay={400} closeDelay={0}>
            <Tooltip.Root disabled={!sendDisabledReason}>
              <Tooltip.Trigger
                render={
                  <span
                    tabIndex={sendDisabledReason ? 0 : undefined}
                    aria-label={sendDisabledReason
                      ? `Send unavailable: ${sendDisabledReason}`
                      : undefined}
                    className="inline-flex shrink-0 rounded-control"
                  >
                    <Button
                      type="button"
                      fullWidth={false}
                      onClick={onSend}
                      disabled={!canSend}
                      className="shrink-0 px-md"
                      aria-label="Send message"
                    >
                      <IconSend size={20} stroke={1.75} aria-hidden="true" />
                    </Button>
                  </span>
                }
              />
              {sendDisabledReason && (
                <Tooltip.Portal>
                  <Tooltip.Positioner side="top" sideOffset={4} className="z-30">
                    <Tooltip.Popup
                      role="tooltip"
                      className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg"
                    >
                      {sendDisabledReason}
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              )}
            </Tooltip.Root>
          </Tooltip.Provider>
        )}
        </div>
      </div>
      {dragActive && !imageSelectionDisabled && (
        <div className="pointer-events-none absolute inset-sm z-10 flex items-center justify-center rounded-control border border-border-strong bg-surface text-ui-sm text-body">
          Add images to this message
        </div>
      )}
    </div>
  );
}
