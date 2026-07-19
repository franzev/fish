import { chatLimits, type ChatStickerId } from "@fish/core/chat";
import type { ClientChatData, ClientChatGif, ClientChatImage } from "@/lib/services";
import type { SendMessageActionState } from "@/features/chat/contracts";
import type { LocalMessage } from "./use-chat-messages";
import type { PendingChatImage } from "./use-chat-image-uploads";
import { chatStore, selectComposerForConversation } from "@/features/chat/model/store";
import { gifProvider } from "@/features/chat/model/gif-provider";

export interface SendWithRequestIdOptions {
  body: string;
  clientRequestId: string;
  replyToMessageId: string | null;
  clearComposer?: boolean;
  attachmentIds?: string[];
  optimisticImages?: ClientChatImage[];
  optimisticStickerId?: ChatStickerId;
  optimisticGif?: ClientChatGif;
  gifQuery?: string;
}

interface UseSendMessageOptions {
  chat: ClientChatData;
  draft: string;
  replyingToId: string | null;
  selectedGif: ClientChatGif | null;
  selectedGifQuery: string;
  selectedStickerId: ChatStickerId | null;
  pendingImages: PendingChatImage[];
  clearPendingImages: () => void;
  composerSelectionRevision?: number;
  setNotice: (notice: string | null) => void;
  stopLocalTyping: () => void;
  setDraft: (conversationId: string, draft: string) => void;
  setReplyTarget: (conversationId: string, messageId: string | null) => void;
  clearComposerSelection: (conversationId: string) => void;
  selectGif: (conversationId: string, gif: ClientChatGif, query: string) => void;
  selectSticker: (conversationId: string, stickerId: ChatStickerId) => void;
  sendOptimisticMessage: (message: LocalMessage) => void;
  confirmSentMessage: (message: LocalMessage, localRequestId?: string) => void;
  markMessageFailed: (conversationId: string, clientRequestId: string, reason?: string) => void;
  sendMessageAction: (input: unknown) => Promise<SendMessageActionState>;
}

function makeRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}`;
}

export function useSendMessage({
  chat,
  draft,
  replyingToId,
  selectedGif,
  selectedGifQuery,
  selectedStickerId,
  pendingImages,
  clearPendingImages,
  composerSelectionRevision,
  setNotice,
  stopLocalTyping,
  setDraft,
  setReplyTarget,
  clearComposerSelection,
  selectGif,
  selectSticker,
  sendOptimisticMessage,
  confirmSentMessage,
  markMessageFailed,
  sendMessageAction,
}: UseSendMessageOptions) {
  async function sendWithRequestId({
    body,
    clientRequestId,
    replyToMessageId,
    clearComposer = false,
    attachmentIds = [],
    optimisticImages = [],
    optimisticStickerId,
    optimisticGif,
    gifQuery = "",
  }: SendWithRequestIdOptions) {
    const sendConversationId = chat.conversationId;
    const selectionRevisionAtSend = composerSelectionRevision ?? 0;
    setNotice(null);
    stopLocalTyping();

    sendOptimisticMessage({
      id: clientRequestId,
      conversationId: sendConversationId,
      senderId: chat.currentUserId,
      senderRole: chat.currentUserRole,
      senderDisplayName: chat.currentUserDisplayName,
      body,
      gif: optimisticGif,
      stickerId: optimisticStickerId,
      attachments: optimisticImages,
      images: optimisticImages,
      clientRequestId,
      editedAt: null,
      deletedAt: null,
      replyToMessageId,
      reactions: [],
      createdAt: new Date().toISOString(),
      localStatus: "sending",
    });

    if (clearComposer) {
      setDraft(sendConversationId, "");
      setReplyTarget(sendConversationId, null);
      clearPendingImages();
      clearComposerSelection(sendConversationId);
    }

    const result = await sendMessageAction({
      conversationId: sendConversationId,
      body,
      clientRequestId,
      replyToMessageId,
      attachmentIds,
      gif: optimisticGif,
      stickerId: optimisticStickerId,
    }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That did not send yet. Keep this open and try again.",
    }));

    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That did not send yet. Keep this open and try again.");
      markMessageFailed(sendConversationId, clientRequestId, result.notice ?? "Not sent yet");
      const currentComposer = selectComposerForConversation(chatStore.getState(), sendConversationId);
      if (
        clearComposer &&
        currentComposer.selectionRevision === selectionRevisionAtSend + 1 &&
        !currentComposer.selectedGif &&
        !currentComposer.selectedStickerId
      ) {
        if (optimisticGif) selectGif(sendConversationId, optimisticGif, gifQuery);
        if (optimisticStickerId) selectSticker(sendConversationId, optimisticStickerId);
      }
      return;
    }

    const sentMessage = result.message as LocalMessage;
    confirmSentMessage(sentMessage, clientRequestId);
    if (optimisticGif) {
      void gifProvider.registerShare({ gif: optimisticGif, query: gifQuery }).catch(() => undefined);
    }
  }

  async function handleSend() {
    const trimmedDraft = draft.trim();
    const readyImages = pendingImages.filter((image) => image.status === "ready");
    const imageUploadsSettled = pendingImages.every((image) => image.status === "ready");
    if (trimmedDraft.length === 0 && readyImages.length === 0 && !selectedGif && !selectedStickerId) {
      setNotice("Add a message before sending.");
      return;
    }
    if (!imageUploadsSettled) {
      setNotice("Let the files finish preparing, then send.");
      return;
    }
    if (trimmedDraft.length > chatLimits.messageBodyMaxLength) {
      setNotice("This message is a little long. Try sending it in two parts.");
      return;
    }

    await sendWithRequestId({
      body: trimmedDraft,
      clientRequestId: makeRequestId(),
      replyToMessageId: replyingToId,
      clearComposer: true,
      attachmentIds: readyImages.flatMap((image) => image.attachmentId ? [image.attachmentId] : []),
      optimisticImages: readyImages.flatMap((image) =>
        image.attachmentId && image.displayPath && image.storedMimeType && image.storedByteSize
          ? [{
              id: image.attachmentId,
              status: "ready" as const,
              kind: image.kind,
              originalName: image.file.name || "File",
              mimeType: image.storedMimeType,
              byteSize: image.storedByteSize,
              width: image.width,
              height: image.height,
              thumbnailPath: image.thumbnailPath,
              displayPath: image.displayPath,
              thumbnailUrl: image.kind === "image" ? image.previewUrl : image.thumbnailUrl,
              displayUrl: image.kind === "image" ? image.previewUrl : image.displayUrl,
            }]
          : []
      ),
      optimisticStickerId: selectedStickerId ?? undefined,
      optimisticGif: selectedGif ?? undefined,
      gifQuery: selectedGifQuery,
    });
  }

  return { handleSend, sendWithRequestId };
}
