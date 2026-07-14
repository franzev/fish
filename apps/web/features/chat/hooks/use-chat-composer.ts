import type { ClientChatData } from "@/lib/services";
import { chatLimits, type ChatStickerId } from "@fish/core/chat";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { SendMessageActionState } from "@/features/chat/contracts";
import type { ReportGifActionState } from "@/features/chat/contracts";
import type { LocalMessage } from "./use-chat-messages";
import type { PendingChatImage } from "./use-chat-image-uploads";
import type { ClientChatGif, ClientChatImage } from "@/lib/services";
import { useChatStore, selectComposerForConversation } from "@/features/chat/model/store";
import { gifProvider } from "@/features/chat/model/gif-provider";

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

interface GifSelectionState {
  conversationId: string;
  gif: ClientChatGif | null;
  query: string;
  revision: number;
}

interface StickerSelectionState {
  conversationId: string;
  stickerId: ChatStickerId | null;
  revision: number;
}

interface EditSessionState {
  conversationId: string;
  messageId: string;
  draft: string;
  notice: string | null;
  saving: boolean;
}

interface MessageMutationResult {
  ok: boolean;
  notice?: string;
}

function makeRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}`;
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
  const [editSession, setEditSession] = useState<EditSessionState | null>(null);
  const [gifSelection, setGifSelection] = useState<GifSelectionState>({
    conversationId: chat.conversationId,
    gif: null,
    query: "",
    revision: 0,
  });
  const [stickerSelection, setStickerSelection] = useState<StickerSelectionState>({
    conversationId: chat.conversationId,
    stickerId: null,
    revision: 0,
  });
  if (gifSelection.conversationId !== chat.conversationId) {
    setGifSelection({
      conversationId: chat.conversationId,
      gif: null,
      query: "",
      revision: gifSelection.revision + 1,
    });
  }
  if (stickerSelection.conversationId !== chat.conversationId) {
    setStickerSelection({
      conversationId: chat.conversationId,
      stickerId: null,
      revision: stickerSelection.revision + 1,
    });
  }
  const selectedGif = gifSelection.gif;
  const selectedGifQuery = gifSelection.query;
  const selectedStickerId = stickerSelection.stickerId;
  const composer = useChatStore((state) =>
    selectComposerForConversation(state, chat.conversationId)
  );
  const setDraft = useChatStore((state) => state.setDraft);
  const setReplyTarget = useChatStore((state) => state.setReplyTarget);
  const sendOptimisticMessage = useChatStore((state) => state.sendOptimisticMessage);
  const confirmSentMessage = useChatStore((state) => state.confirmSentMessage);
  const markMessageFailed = useChatStore((state) => state.markMessageFailed);
  const mergeRemoteMessage = useChatStore((state) => state.mergeRemoteMessage);

  const { draft, replyTargetId: replyingToId } = composer;
  const activeEdit = editSession?.conversationId === chat.conversationId
    ? editSession
    : null;
  const trimmedDraft = draft.trim();
  const readyImages = pendingImages.filter((image) => image.status === "ready");
  const imageUploadsSettled = pendingImages.every((image) => image.status === "ready");
  const canSend = (
    trimmedDraft.length > 0
    || readyImages.length > 0
    || Boolean(selectedGif)
    || Boolean(selectedStickerId)
  )
    && imageUploadsSettled;
  const replyingTo = useMemo(
    () =>
      replyingToId
        ? messages.find((message) => message.id === replyingToId) ?? null
        : null,
    [messages, replyingToId]
  );
  const editingMessage = useMemo(
    () =>
      activeEdit
        ? messages.find(
            (message) => message.id === activeEdit.messageId && !message.deletedAt
          ) ?? null
        : null,
    [activeEdit, messages]
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

  async function sendWithRequestId(
    body: string,
    clientRequestId: string,
    replyToMessageId: string | null,
    clearComposer = false,
    attachmentIds: string[] = [],
    optimisticImages: ClientChatImage[] = [],
    optimisticStickerId?: ChatStickerId,
    optimisticGif?: ClientChatGif,
    gifQuery = ""
  ) {
    const sendConversationId = chat.conversationId;
    const gifSelectionRevisionAtSend = gifSelection.revision;
    const stickerSelectionRevisionAtSend = stickerSelection.revision;
    setNotice(null);
    stopLocalTyping();

    const optimistic: LocalMessage = {
      id: clientRequestId,
      conversationId: chat.conversationId,
      senderId: chat.currentUserId,
      senderRole: chat.currentUserRole,
      senderDisplayName: chat.currentUserDisplayName,
      body,
      gif: optimisticGif,
      stickerId: optimisticStickerId,
      images: optimisticImages,
      clientRequestId,
      editedAt: null,
      deletedAt: null,
      replyToMessageId,
      reactions: [],
      createdAt: new Date().toISOString(),
      localStatus: "sending",
    };

    sendOptimisticMessage(optimistic);

    if (clearComposer) {
      setDraft(chat.conversationId, "");
      setReplyTarget(chat.conversationId, null);
      clearPendingImages();
      setGifSelection((current) =>
        current.conversationId === sendConversationId
          ? { ...current, gif: null, query: "" }
          : current
      );
      setStickerSelection((current) =>
        current.conversationId === sendConversationId
          ? { ...current, stickerId: null }
          : current
      );
    }

    const result = await sendMessageAction({
      conversationId: chat.conversationId,
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
      // The reducer owns draft restoration on failure (restores the failed
      // body only when nothing newer was typed) — do not clear here, or a
      // delayed failure could wipe a draft the user already started.
      markMessageFailed(
        chat.conversationId,
        clientRequestId,
        result.notice ?? "Not sent yet"
      );
      if (clearComposer && optimisticGif) {
        setGifSelection((current) =>
          current.conversationId === sendConversationId
          && current.revision === gifSelectionRevisionAtSend
          && current.gif === null
            ? { ...current, gif: optimisticGif, query: gifQuery }
            : current
        );
      }
      if (clearComposer && optimisticStickerId) {
        setStickerSelection((current) =>
          current.conversationId === sendConversationId
          && current.revision === stickerSelectionRevisionAtSend
          && current.stickerId === null
            ? { ...current, stickerId: optimisticStickerId }
            : current
        );
      }
      return;
    }

    const sentMessage = result.message;
    confirmSentMessage(sentMessage, clientRequestId);
    if (optimisticGif) {
      void gifProvider.registerShare({ gif: optimisticGif, query: gifQuery }).catch(() => undefined);
    }
  }

  async function handleSaveEdit() {
    if (!activeEdit) return;

    const body = activeEdit.draft.trim();
    if (body.length === 0) {
      setEditSession((current) => current
        ? { ...current, notice: "Add some text before saving." }
        : current
      );
      return;
    }
    if (body.length > chatLimits.messageBodyMaxLength) {
      setEditSession((current) => current
        ? {
            ...current,
            notice: "This message is a little long. Try shortening it.",
          }
        : current
      );
      return;
    }
    if (!editMessageAction) {
      setEditSession((current) => current
        ? { ...current, notice: "Editing is not available yet." }
        : current
      );
      return;
    }

    const editingMessageId = activeEdit.messageId;
    setEditSession((current) =>
      current?.messageId === editingMessageId
        ? { ...current, notice: null, saving: true }
        : current
    );
    const result = await editMessageAction({
      messageId: editingMessageId,
      body,
    }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That didn’t save yet. Your changes are still here. Try again.",
    }));

    if (result.status !== "sent" || !result.message) {
      setEditSession((current) =>
        current?.messageId === editingMessageId
          ? {
              ...current,
              saving: false,
              notice:
                result.notice
                ?? "That didn’t save yet. Your changes are still here. Try again.",
            }
          : current
      );
      return;
    }

    mergeRemoteMessage(result.message!);
    setEditSession((current) =>
      current?.messageId === editingMessageId ? null : current
    );
  }

  async function handleSend() {
    if (
      trimmedDraft.length === 0
      && readyImages.length === 0
      && !selectedGif
      && !selectedStickerId
    ) {
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

    await sendWithRequestId(
      trimmedDraft,
      makeRequestId(),
      replyingToId,
      true,
      readyImages.flatMap((image) => image.attachmentId ? [image.attachmentId] : []),
      readyImages.flatMap((image) =>
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
      selectedStickerId ?? undefined,
      selectedGif ?? undefined,
      selectedGifQuery
    );
  }

  async function handleDeleteMessage(
    message: LocalMessage
  ): Promise<MessageMutationResult> {
    if (!deleteMessageAction) {
      return { ok: false, notice: "Deleting is not available yet." };
    }

    setNotice(null);
    const result = await deleteMessageAction({ messageId: message.id }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That didn’t delete yet. Keep this open and try again.",
    }));
    if (result.status !== "sent" || !result.message) {
      return {
        ok: false,
        notice:
          result.notice ?? "That didn’t delete yet. Keep this open and try again.",
      };
    }

    mergeRemoteMessage(result.message!);
    return { ok: true };
  }

  async function handleToggleReaction(message: LocalMessage, emoji: string) {
    if (!toggleReactionAction) {
      setNotice("That reaction did not save yet. Keep this open and try again.");
      return;
    }

    const result = await toggleReactionAction({
      messageId: message.id,
      emoji,
    }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That reaction did not save yet. Keep this open and try again.",
    }));

    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That reaction did not save yet. Keep this open and try again.");
      return;
    }

    mergeRemoteMessage(result.message!);
  }

  async function handleReportGif(message: LocalMessage) {
    if (!message.gif || !reportGifAction) {
      setNotice("That GIF is not available.");
      return;
    }
    const result = await reportGifAction({ messageId: message.id }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That report did not send yet. Try again.",
    }));
    setNotice(result.status === "sent"
      ? "Thanks. This GIF was reported."
      : result.notice ?? "That report did not send yet. Try again.");
  }

  function startReplyingToMessage(message: LocalMessage) {
    setReplyTarget(chat.conversationId, message.id);
    setNotice(null);
  }

  function startEditingMessage(message: LocalMessage) {
    setReplyTarget(chat.conversationId, null);
    setEditSession({
      conversationId: chat.conversationId,
      messageId: message.id,
      draft: message.body,
      notice: null,
      saving: false,
    });
    setNotice(null);
  }

  function handleEditDraftChange(value: string) {
    setEditSession((current) =>
      current?.conversationId === chat.conversationId
        ? { ...current, draft: value, notice: null }
        : current
    );
  }

  function cancelReply() {
    setReplyTarget(chat.conversationId, null);
  }

  function cancelEdit() {
    setEditSession((current) =>
      current?.conversationId === chat.conversationId ? null : current
    );
  }

  function selectGif(gif: ClientChatGif, query: string) {
    setGifSelection((current) => ({
      conversationId: chat.conversationId,
      gif,
      query,
      revision: current.revision + 1,
    }));
    setStickerSelection((current) => ({
      ...current,
      stickerId: null,
      revision: current.revision + 1,
    }));
    setNotice(null);
  }

  function removeSelectedGif() {
    setGifSelection((current) => ({
      ...current,
      gif: null,
      query: "",
      revision: current.revision + 1,
    }));
  }

  function selectSticker(stickerId: ChatStickerId) {
    setStickerSelection((current) => ({
      conversationId: chat.conversationId,
      stickerId,
      revision: current.revision + 1,
    }));
    setGifSelection((current) => ({
      ...current,
      gif: null,
      query: "",
      revision: current.revision + 1,
    }));
    setNotice(null);
  }

  function removeSelectedSticker() {
    setStickerSelection((current) => ({
      ...current,
      stickerId: null,
      revision: current.revision + 1,
    }));
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!canSend) return;
    void handleSend();
  }

  return {
    draft,
    selectedGif,
    selectedStickerId,
    notice,
    canSend,
    replyingTo,
    editingMessage,
    editDraft: activeEdit?.draft ?? "",
    editNotice: activeEdit?.notice ?? null,
    isSavingEdit: activeEdit?.saving ?? false,
    handleDraftChange,
    handleSend,
    sendWithRequestId,
    handleDeleteMessage,
    handleToggleReaction,
    handleReportGif,
    startReplyingToMessage,
    startEditingMessage,
    handleEditDraftChange,
    handleSaveEdit,
    cancelReply,
    cancelEdit,
    selectGif,
    removeSelectedGif,
    selectSticker,
    removeSelectedSticker,
    handleComposerKeyDown,
  };
}
