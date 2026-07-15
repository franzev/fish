import { cn } from "@/lib/utils";
import Image from "next/image";
import { getChatSticker } from "../sticker-picker/sticker-catalog";

export interface StickerMediaProps {
  stickerId: string;
  className?: string;
  displaySize?: "tile" | "control";
  loading?: "eager" | "lazy";
}

/** Resolves a stable message sticker id to its bundled application asset. */
export function StickerMedia({
  stickerId,
  className,
  displaySize = "tile",
  loading = "lazy",
}: StickerMediaProps) {
  const sticker = getChatSticker(stickerId);
  const dimension = displaySize === "control" ? 44 : 96;
  const sizeClass = displaySize === "control" ? undefined : "size-sticker-tile";
  if (!sticker) {
    return (
      <span
        role="img"
        aria-label="Sticker unavailable"
        className={cn(
          "inline-flex items-center justify-center rounded-control bg-surface-2 px-xs text-center text-ui-xs text-muted",
          sizeClass,
          className
        )}
      >
        Sticker unavailable
      </span>
    );
  }

  return (
    <Image
      src={sticker.src}
      alt={sticker.description}
      width={dimension}
      height={dimension}
      sizes={`${dimension}px`}
      loading={loading}
      className={cn(sizeClass, "object-contain", className)}
    />
  );
}
