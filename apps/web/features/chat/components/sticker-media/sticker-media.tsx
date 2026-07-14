import { cn } from "@/lib/utils";
import Image from "next/image";
import { getChatSticker } from "../sticker-picker/sticker-catalog";

export interface StickerMediaProps {
  stickerId: string;
  className?: string;
}

/** Resolves a stable message sticker id to its bundled application asset. */
export function StickerMedia({
  stickerId,
  className,
}: StickerMediaProps) {
  const sticker = getChatSticker(stickerId);
  if (!sticker) {
    return (
      <span
        role="img"
        aria-label="Sticker unavailable"
        className={cn(
          "inline-flex size-sticker-tile items-center justify-center rounded-control bg-surface-2 px-xs text-center text-ui-xs text-muted",
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
      width={96}
      height={96}
      sizes="96px"
      className={cn("size-sticker-tile object-contain", className)}
    />
  );
}
