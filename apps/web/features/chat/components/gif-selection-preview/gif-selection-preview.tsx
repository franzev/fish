import { IconButton } from "@/components/ui/icon-button";
import type { ClientChatGif } from "@/lib/services";
import { IconX } from "@tabler/icons-react";
import { GifMedia } from "../gif-media";

interface GifSelectionPreviewProps {
  gif: ClientChatGif;
  onRemove: () => void;
}

export function GifSelectionPreview({ gif, onRemove }: GifSelectionPreviewProps) {
  return (
    <div className="flex items-start gap-xs border-b border-border p-xs">
      <GifMedia
        gif={gif}
        preview
        allowPlaybackControl
        className="w-chat-gif-selection shrink-0"
      />
      <p className="min-w-0 flex-1 py-xs text-ui-xs text-muted">
        GIF selected
      </p>
      <IconButton
        label="Remove selected GIF"
        appearance="ghost"
        onClick={onRemove}
        className="hover:bg-surface"
        icon={<IconX size={20} stroke={1.75} aria-hidden="true" />}
      />
    </div>
  );
}
