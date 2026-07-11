import { Alert } from "@/components/ui/alert";
import { getMessageSnippet } from "@/features/chat/model/chat-state";
import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import type { ClientChatData } from "@/lib/services";
import { cn } from "@/lib/utils";
import { IconX } from "@tabler/icons-react";
import type { KeyboardEvent } from "react";
import { Composer, QuotedMessage } from "./visual";

interface ChatComposerSurfaceProps {
  chat: ClientChatData;
  isOffline: boolean;
  notice: string | null;
  replyingTo: LocalMessage | null;
  editingMessage: LocalMessage | null;
  draft: string;
  canSend: boolean;
  getMessageAuthorName: (message: LocalMessage) => string;
  cancelReply: () => void;
  cancelEdit: () => void;
  handleDraftChange: (value: string) => void;
  handleSend: () => Promise<void>;
  handleComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  stopLocalTyping: () => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

export function ChatComposerSurface({
  chat,
  isOffline,
  notice,
  replyingTo,
  editingMessage,
  draft,
  canSend,
  getMessageAuthorName,
  cancelReply,
  cancelEdit,
  handleDraftChange,
  handleSend,
  handleComposerKeyDown,
  stopLocalTyping,
  scrollToBottom,
}: ChatComposerSurfaceProps) {
  return (
    <>
      {isOffline && (
        <Alert tone="notice" className="mx-md mb-xs">
          You&apos;re offline. Reconnect, then try again.
        </Alert>
      )}

      {notice && (
        <Alert tone="notice" className="mx-md mb-xs">
          {notice}
        </Alert>
      )}

      {(replyingTo || editingMessage) && (
        <div className="border-t border-border bg-surface px-md py-sm">
          {replyingTo && (
            <div className="flex items-center gap-xs">
              <div className="min-w-0 flex-1">
                <p className="text-ui-xs text-muted">
                  Replying to{" "}
                  {replyingTo.senderId === chat.currentUserId
                    ? "your message"
                    : getMessageAuthorName(replyingTo)}
                </p>
                <QuotedMessage
                  authorName={getMessageAuthorName(replyingTo)}
                  snippet={getMessageSnippet(replyingTo)}
                  className="mb-0 mt-2xs"
                />
              </div>
              <button
                type="button"
                aria-label="Cancel reply"
                onClick={cancelReply}
                className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
              >
                <IconX size={18} stroke={1.75} aria-hidden="true" />
              </button>
            </div>
          )}
          {editingMessage && (
            <div className="flex items-center gap-xs text-ui-sm text-muted">
              <span className="min-w-0 flex-1">Editing message</span>
              <button
                type="button"
                aria-label="Cancel edit"
                onClick={cancelEdit}
                className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-body"
              >
                <IconX size={18} stroke={1.75} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className={cn(isOffline && "opacity-60")}>
        <Composer
          channelName={chat.channelName}
          draft={draft}
          canSend={canSend}
          onDraftChange={handleDraftChange}
          onSend={() => {
            scrollToBottom();
            void handleSend();
          }}
          onKeyDown={handleComposerKeyDown}
          onBlur={stopLocalTyping}
          onSelectEmoji={(emoji) => handleDraftChange(draft + emoji)}
        />
      </div>
    </>
  );
}
