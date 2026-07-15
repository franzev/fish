import { Alert } from "@/components/ui/alert";
import { IconButton } from "@/components/ui/icon-button";
import { getMessageSnippet } from "@/features/chat/model/chat-state";
import type { LocalMessage } from "@/features/chat/hooks/use-chat-messages";
import type { ClientChatData } from "@/lib/services";
import { cn } from "@/lib/utils";
import { IconX } from "@tabler/icons-react";
import type { KeyboardEvent } from "react";
import type { PendingChatImage } from "@/features/chat/hooks/use-chat-image-uploads";
import type { ClientChatGif } from "@/lib/services";
import type { ChatStickerId } from "@fish/core/chat";
import { Composer, QuotedMessage } from "../visual";

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
  handleDraftChange: (value: string) => void;
  handleSend: () => Promise<void>;
  handleComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  stopLocalTyping: () => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  images: PendingChatImage[];
  imageNotice: string | null;
  addImages: (files: File[]) => void;
  removeImage: (clientUploadId: string) => void;
  retryImage: (clientUploadId: string) => void;
  selectedGif: ClientChatGif | null;
  selectGif: (gif: ClientChatGif, query: string) => void;
  removeSelectedGif: () => void;
  selectedStickerId: ChatStickerId | null;
  selectSticker: (stickerId: ChatStickerId) => void;
  removeSelectedSticker: () => void;
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
  handleDraftChange,
  handleSend,
  handleComposerKeyDown,
  stopLocalTyping,
  scrollToBottom,
  images,
  imageNotice,
  addImages,
  removeImage,
  retryImage,
  selectedGif,
  selectGif,
  removeSelectedGif,
  selectedStickerId,
  selectSticker,
  removeSelectedSticker,
}: ChatComposerSurfaceProps) {
  return (
    <>
      {notice && (
        <Alert tone="notice" className="mx-md mb-xs">
          {notice}
        </Alert>
      )}

      {imageNotice && (
        <Alert tone="notice" className="mx-md mb-xs">
          {imageNotice}
        </Alert>
      )}

      {replyingTo && (
        <div className="border-t border-border bg-surface px-md py-sm">
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
            <IconButton
              label="Cancel reply"
              appearance="ghost"
              onClick={cancelReply}
              icon={<IconX size={20} stroke={1.75} aria-hidden="true" />}
            />
          </div>
        </div>
      )}

      {editingMessage ? (
        <div className="px-sm pt-sm md:pb-sm">
          <div
            role="status"
            className="flex min-h-control items-center rounded-control bg-surface-2 px-md text-ui-sm text-muted"
          >
            Finish editing the message above
          </div>
        </div>
      ) : (
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
            images={images}
            onSelectImages={addImages}
            onRemoveImage={(id) => void removeImage(id)}
            onRetryImage={retryImage}
            imageSelectionDisabled={
              isOffline || Boolean(selectedGif) || Boolean(selectedStickerId)
            }
            selectedGif={selectedGif}
            onSelectGif={selectGif}
            onRemoveGif={removeSelectedGif}
            gifSelectionDisabled={
              isOffline || images.length > 0 || Boolean(selectedStickerId)
            }
            selectedStickerId={selectedStickerId}
            onRemoveSticker={removeSelectedSticker}
            onSelectSticker={(sticker) => selectSticker(sticker.id)}
            stickerSelectionDisabled={
              isOffline || Boolean(selectedGif) || images.length > 0
            }
          />
        </div>
      )}
    </>
  );
}
