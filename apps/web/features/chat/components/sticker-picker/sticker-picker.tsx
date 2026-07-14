"use client";

import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { MediaPickerScrollArea } from "../media-picker-scroll-area";
import { MediaPickerSearch } from "../media-picker-search";
import { StickerMedia } from "../sticker-media";
import {
  aquaticStickers,
  type ChatSticker,
} from "./sticker-catalog";

interface StickerPickerProps {
  onSelect: (sticker: ChatSticker) => void;
  className?: string;
}

/** Search the default aquatic sticker pack. */
export function StickerPicker({ onSelect, className }: StickerPickerProps) {
  const [query, setQuery] = useState("");

  const stickers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return aquaticStickers.filter((sticker) => {
      const matchesQuery = !normalizedQuery || [
        sticker.phrase,
        sticker.animal,
        sticker.description,
        ...sticker.keywords,
        ...sticker.styles,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesQuery;
    });
  }, [query]);

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col", className)}
      aria-label="Browse stickers"
    >
      <MediaPickerSearch
        label="Search stickers"
        placeholder="Search stickers"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <MediaPickerScrollArea>
        {stickers.length > 0 ? (
          <div
            className="grid grid-cols-3 gap-2xs"
            data-testid="sticker-grid"
          >
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                aria-label={`Add ${sticker.phrase} sticker`}
                onClick={() => onSelect(sticker)}
                className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-control bg-surface-2 hover:bg-surface-3"
              >
                <StickerMedia
                  stickerId={sticker.id}
                  className="size-full object-contain"
                />
              </button>
            ))}
          </div>
        ) : (
          <p role="status" className="py-lg text-center text-ui-sm text-muted">
            No stickers match that yet.
          </p>
        )}
      </MediaPickerScrollArea>
    </div>
  );
}
