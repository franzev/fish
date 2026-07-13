"use client";

import { IconTabStrip, type IconTabStripItem } from "@/components/ui/icon-tab-strip";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  IconHeart,
  IconLayoutGrid,
  IconPencil,
  IconSearch,
  IconSparkles,
  type TablerIcon,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { StickerMedia } from "../sticker-media";
import {
  aquaticStickers,
  stickerStyleFilters,
  type ChatSticker,
  type StickerStyle,
} from "./sticker-catalog";

interface StickerPickerProps {
  onSelect: (sticker: ChatSticker) => void;
  className?: string;
}

const styleFilterIcons: Record<"all" | StickerStyle, TablerIcon> = {
  all: IconLayoutGrid,
  cute: IconHeart,
  "hand-drawn": IconPencil,
  expressive: IconSparkles,
};

const styleTabs: readonly IconTabStripItem[] = stickerStyleFilters.map((filter) => ({
  value: filter.id,
  label: filter.label,
  Icon: styleFilterIcons[filter.id],
}));

/** Search and style discovery for the default aquatic sticker pack. */
export function StickerPicker({ onSelect, className }: StickerPickerProps) {
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState<"all" | StickerStyle>("all");

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
      const matchesStyle = style === "all" || sticker.styles.includes(style);
      return matchesQuery && matchesStyle;
    });
  }, [query, style]);

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col", className)}
      aria-label="Browse stickers"
    >
      <div className="shrink-0 px-xs py-2xs">
        <Input
          type="search"
          label="Search stickers"
          labelVisuallyHidden
          reserveMessageSpace={false}
          density="compact"
          placeholder="Search stickers"
          value={query}
          maxLength={50}
          onChange={(event) => setQuery(event.target.value)}
          leadingIcon={<IconSearch size={16} stroke={1.75} aria-hidden="true" />}
        />
      </div>

      <ScrollArea className="flex-1" viewportClassName="scroll-smooth px-xs py-2xs">
        {stickers.length > 0 ? (
          <div className="grid grid-cols-3 gap-2xs" data-testid="sticker-grid">
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                aria-label={`Add ${sticker.phrase} sticker`}
                onClick={() => onSelect(sticker)}
                className="size-sticker-tile justify-self-center overflow-hidden rounded-control bg-surface-2 hover:bg-surface-3"
              >
                <StickerMedia stickerId={sticker.id} />
              </button>
            ))}
          </div>
        ) : (
          <p role="status" className="py-lg text-center text-ui-sm text-muted">
            No stickers match that yet.
          </p>
        )}
      </ScrollArea>
      <IconTabStrip
        items={styleTabs}
        ariaLabel="Sticker style"
        selectionMode="filter"
        value={style}
        onValueChange={(value) => setStyle(value as "all" | StickerStyle)}
      />
    </div>
  );
}
