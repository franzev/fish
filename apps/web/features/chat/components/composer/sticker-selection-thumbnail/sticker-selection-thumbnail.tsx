"use client";

import { IconButton } from "@/components/ui/icon-button";
import type { ChatStickerId } from "@fish/core/chat";
import { IconX } from "@tabler/icons-react";
import { StickerMedia } from "../../sticker-media";

interface StickerSelectionThumbnailProps {
  stickerId: ChatStickerId;
  onRemove: () => void;
}

/** Shows the selected sticker in-place without increasing composer height. */
export function StickerSelectionThumbnail({
  stickerId,
  onRemove,
}: StickerSelectionThumbnailProps) {
  return (
    <IconButton
      label="Remove selected sticker"
      appearance="ghost"
      onClick={onRemove}
      className="relative shrink-0 overflow-hidden p-0 hover:bg-surface"
      icon={
        <>
          <StickerMedia stickerId={stickerId} displaySize="control" loading="eager" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3xs top-3xs inline-flex size-lg items-center justify-center rounded-pill bg-surface text-body"
          >
            <IconX size={20} stroke={1.75} />
          </span>
        </>
      }
    />
  );
}
