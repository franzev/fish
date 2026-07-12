import type { ClientChatGif } from "@/lib/services";
import { GifMedia } from "../gif-media";

interface MessageGifProps {
  gif: ClientChatGif;
}

export function MessageGif({ gif }: MessageGifProps) {
  return (
    <div className="w-full max-w-chat-gif">
      <GifMedia gif={gif} allowPlaybackControl />
      <a
        href={gif.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2xs inline-flex min-h-target-touch items-center text-ui-xs text-muted hover:text-body hover:underline"
      >
        Via {gif.provider === "klipy" ? "KLIPY" : "GIPHY"}
      </a>
    </div>
  );
}
