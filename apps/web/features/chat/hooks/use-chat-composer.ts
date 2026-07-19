import { type ChatStickerId } from "@fish/core/chat";
import type { ClientChatData, ClientChatGif } from "@/lib/services";
import type { ReportGifActionState, SendMessageActionState } from "@/features/chat/contracts";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { LocalMessage } from "./use-chat-messages";
import type { PendingChatImage } from "./use-chat-image-uploads";
import {
  selectComposerForConversation,
  useChatStore,
} from "@/features/chat/model/store";
import { useMessageMutations } from "./use-message-mutations";
import { useSendMessage, type SendWithRequestIdOptions } from "./use-send-message";

interface UseChatComposerOptions {
  chat: ClientChatData;
  messages: LocalMessage[];
  sendMessageAction: (input: unknown) => Promise<SendMessageActionState>;
  editMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  deleteMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  toggleReactionAction?: (input: unknown) => Promise<SendMessageActionState>;
  reportGifAction?: (input: unknown) => Promise<ReportGifActionState>;
  sendLocalTyping: (typing: boolean) => void;
  stopLocalTyping: () => void;
  scheduleLocalTypingStop: () => void;
  pendingImages: PendingChatImage[];
  clearPendingImages: () => void;
}

export function useChatComposer({
  chat,
  messages,
  sendMessageAction,
  editMessageAction,
  deleteMessageAction,
  toggleReactionAction,
  reportGifAction,
  sendLocalTyping,
  stopLocalTyping,
  scheduleLocalTypingStop,
  pendingImages,
  clearPendingImages,
}: UseChatComposerOptions) {
  const [notice, setNotice] = useState<string | null>(null);
  const composer = useChatStore((state) =>
    selectComposerForConversation(state, chat.conversationId)
  );
  const setDraft = useChatStore((state) => state.setDraft);
  const setReplyTarget = useChatStore((state) => state.setReplyTarget);
  const sendOptimisticMessage = useChatStore((state) => state.sendOptimisticMessage);
  const confirmSentMessage = useChatStore((state) => state.confirmSentMessage);
  const markMessageFailed = useChatStore((state) => state.markMessageFailed);
  const mergeRemoteMessage = useChatStore((state) => state.mergeRemoteMessage);
  const selectGif = useChatStore((state) => state.selectGif);
  const selectSticker = useChatStore((state) => state.selectSticker);
  const clearComposerSelection = useChatStore((state) => state.clearComposerSelection);
  const requestDelete = useChatStore((state) => state.requestDelete);
  const failDelete = useChatStore((state) => state.failDelete);

  const {
    draft,
    replyTargetId: replyingToId,
    selectedGif: composerGif,
    selectedGifQuery: composerGifQuery,
    selectedStickerId: composerStickerId,
    selectionRevision: composerSelectionRevision,
  } = composer;
  const selectedGif = composerGif ?? null;
  const selectedGifQuery = composerGifQuery ?? "";
  const selectedStickerId = composerStickerId ?? null;
  const readyImages = pendingImages.filter((image) => image.status === "ready");
  const imageUploadsSettled = pendingImages.every((image) => image.status === "ready");
  const canSend = (
    draft.trim().length > 0 ||
    readyImages.length > 0 ||
    Boolean(selectedGif) ||
    Boolean(selectedStickerId)
  ) && imageUploadsSettled;
  const replyingTo = useMemo(
    () => replyingToId ? messages.find((message) => message.id === replyingToId) ?? null : null,
    [messages, replyingToId]
  );

  function handleDraftChange(value: string) {
    setDraft(chat.conversationId, value);
    setNotice(null);
    if (value.trim().length === 0) {
      stopLocalTyping();
      return;
    }
    sendLocalTyping(true);
    scheduleLocalTypingStop();
  }

  const { handleSend, sendWithRequestId } = useSendMessage({
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
  });
  const mutations = useMessageMutations({
    chat,
    messages,
    editMessageAction,
    deleteMessageAction,
    toggleReactionAction,
    reportGifAction,
    setReplyTarget,
    setNotice,
    mergeRemoteMessage,
    requestDelete,
    failDelete,
  });

  function startReplyingToMessage(message: LocalMessage) {
    setReplyTarget(chat.conversationId, message.id);
    setNotice(null);
  }

  function cancelReply() {
    setReplyTarget(chat.conversationId, null);
  }

  function selectGifFromPicker(gif: ClientChatGif, query: string) {
    selectGif(chat.conversationId, gif, query);
    setNotice(null);
  }

  function removeSelectedGif() {
    clearComposerSelection(chat.conversationId);
  }

  function selectStickerFromPicker(stickerId: ChatStickerId) {
    selectSticker(chat.conversationId, stickerId);
    setNotice(null);
  }

  function removeSelectedSticker() {
    clearComposerSelection(chat.conversationId);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (canSend) void handleSend();
  }

  return {
    draft,
    selectedGif,
    selectedStickerId,
    notice,
    canSend,
    replyingTo,
    ...mutations,
    handleDraftChange,
    handleSend,
    sendWithRequestId: sendWithRequestId as (options: SendWithRequestIdOptions) => Promise<void>,
    startReplyingToMessage,
    cancelReply,
    selectGif: selectGifFromPicker,
    removeSelectedGif,
    selectSticker: selectStickerFromPicker,
    removeSelectedSticker,
    handleComposerKeyDown,
  };
}
