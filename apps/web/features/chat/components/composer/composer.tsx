"use client";

import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  IconMoodSmile,
  IconSend,
} from "@tabler/icons-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { AddMenu } from "./add-menu";
import type { PendingChatImage } from "@/features/chat/hooks/use-chat-image-uploads";
import { ImageUploadPreview } from "./image-upload-preview";
import type { ClientChatGif } from "@/lib/services";
import { GifSelectionPreview } from "../gif-selection-preview";
import { MediaPickerButton } from "../media-picker-button";
import type { ChatSticker } from "../sticker-picker";
import type { ChatStickerId } from "@fish/core/chat";
import { StickerSelectionThumbnail } from "./sticker-selection-thumbnail";

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

function resizeComposer(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  const contentHeight = textarea.scrollHeight;
  textarea.style.height = `${contentHeight}px`;
  textarea.style.overflowY = contentHeight > textarea.clientHeight
    ? "auto"
    : "hidden";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizedDraftRef = useRef<string | null>(null);
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

  useLayoutEffect(() => {
    if (resizedDraftRef.current === draft) {
      resizedDraftRef.current = null;
      return;
    }
    if (textareaRef.current) resizeComposer(textareaRef.current);
  }, [draft]);

  return (
    <div
      className="relative px-sm pt-sm md:pb-sm"
      onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <div className="rounded-control bg-surface-2">
        <ImageUploadPreview images={images} onRemove={onRemoveImage} onRetry={onRetryImage} />
        {selectedGif && <GifSelectionPreview gif={selectedGif} onRemove={onRemoveGif} />}
        <div className="flex items-end gap-2xs p-xs md:gap-xs">
          {selectedStickerId ? (
            <StickerSelectionThumbnail
              stickerId={selectedStickerId}
              onRemove={onRemoveSticker}
            />
          ) : (
            <AddMenu onSelectImages={onSelectImages} disabled={imageSelectionDisabled} />
          )}
          <textarea
            ref={textareaRef}
            aria-label="Message"
            value={draft}
            onChange={(event) => {
              resizeComposer(event.currentTarget);
              resizedDraftRef.current = event.currentTarget.value;
              onDraftChange(event.currentTarget.value);
            }}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            rows={1}
            enterKeyHint="send"
            placeholder={channelName ? `Message #${channelName}` : "Message"}
            className="h-control max-h-chat-composer-max-height min-h-control min-w-0 flex-1 resize-none border-none bg-transparent px-2xs pb-xs pt-sm text-ui-md text-foreground outline-none placeholder:text-muted focus-visible:bg-transparent md:px-xs md:text-ui-sm"
          />
          <MediaPickerButton
            onSelectEmoji={onSelectEmoji}
            onSelectGif={onSelectGif}
            onSelectSticker={onSelectSticker}
            gifDisabled={gifSelectionDisabled}
            stickerDisabled={stickerSelectionDisabled}
            className="shrink-0 hover:bg-surface-3"
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
                      className="inline-flex size-control shrink-0 rounded-control"
                    >
                      <IconButton
                        type="button"
                        onClick={onSend}
                        disabled={!canSend}
                        className="shrink-0"
                        label="Send message"
                        appearance="solid"
                        icon={<IconSend size={20} stroke={1.75} aria-hidden="true" />}
                      />
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
          {!hasSendContent && (
            <span
              data-slot="mobile-send-reserved-space"
              aria-hidden="true"
              className="hidden size-control shrink-0 max-md:inline-flex"
            />
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
