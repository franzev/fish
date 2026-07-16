import stickerCatalog from "@fish/core/chat-media/sticker-catalog.json";
import type { ChatStickerId } from "@fish/core/chat";

export type StickerStyle = "cute" | "hand-drawn" | "expressive";

export interface ChatSticker {
  id: ChatStickerId;
  phrase: string;
  animal: string;
  description: string;
  src: string;
  styles: readonly StickerStyle[];
  keywords: readonly string[];
}

/** One shared catalog backs web search, Android search, persisted-id
 * fallbacks, and backend drift verification. */
export const aquaticStickers = stickerCatalog as readonly ChatSticker[];

const aquaticStickersById = new Map(
  aquaticStickers.map((sticker) => [sticker.id, sticker])
);

export function getChatSticker(stickerId: string): ChatSticker | null {
  return aquaticStickersById.get(stickerId as ChatStickerId) ?? null;
}
