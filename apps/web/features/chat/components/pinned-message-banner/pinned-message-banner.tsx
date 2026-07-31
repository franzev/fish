import type { ClientChatMessage } from "@/lib/services";
import { IconPinFilled } from "@tabler/icons-react";

export interface PinnedMessageBannerProps {
  message: Pick<ClientChatMessage, "body"> | null;
  onFocus: () => void;
}

/** One quiet row above the transcript when the conversation has a pinned
 * message. Its only behavior is tap/Enter to focus the pinned message —
 * unpinning lives in the message's own action menu, never a second control
 * here. Renders nothing without a resolvable pin; never a loading skeleton. */
export function PinnedMessageBanner({ message, onFocus }: PinnedMessageBannerProps) {
  if (!message) {
    return null;
  }

  const snippet = message.body.trim();
  if (!snippet) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onFocus}
      aria-label={`Pinned message: ${snippet}`}
      className="mx-md mb-xs mt-md flex min-h-control shrink-0 items-center gap-xs rounded-control bg-surface-2 px-sm text-left"
    >
      <IconPinFilled
        size={18}
        stroke={1.75}
        aria-hidden="true"
        className="shrink-0 text-muted"
      />
      <span className="min-w-0 flex-1 truncate text-ui-sm text-body">
        {snippet}
      </span>
    </button>
  );
}
