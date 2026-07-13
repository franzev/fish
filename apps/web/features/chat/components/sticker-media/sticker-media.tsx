import { cn } from "@/lib/utils";
import type { ChatStickerId } from "@fish/core/chat";
import Image from "next/image";
import { getChatSticker } from "../sticker-picker/sticker-catalog";

interface StickerMediaProps {
  stickerId: ChatStickerId;
  className?: string;
}

/** Resolves a stable message sticker id to its bundled application asset. */
export function StickerMedia({
  stickerId,
  className,
}: StickerMediaProps) {
  const sticker = getChatSticker(stickerId);
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
