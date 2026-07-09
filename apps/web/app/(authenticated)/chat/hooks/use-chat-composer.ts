import type { ClientChatData } from "@/lib/services";
import { chatLimits } from "@fish/core/chat";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { SendMessageActionState } from "../actions";
import type { LocalMessage } from "./use-chat-messages";
import { useChatStore } from "../store/chat-store";
import { selectComposerForConversation } from "../store/chat-selectors";

interface UseChatComposerOptions {
  chat: ClientChatData;
  messages: LocalMessage[];
  sendMessageAction: (input: unknown) => Promise<SendMessageActionState>;
  editMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  deleteMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  toggleReactionAction?: (input: unknown) => Promise<SendMessageActionState>;
  sendLocalTyping: (typing: boolean) => void;
  stopLocalTyping: () => void;
  scheduleLocalTypingStop: () => void;
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
  sendLocalTyping,
  stopLocalTyping,
  scheduleLocalTypingStop,
}: UseChatComposerOptions) {
  const [notice, setNotice] = useState<string | null>(null);
  const composer = useChatStore((state) =>
    selectComposerForConversation(state, chat.conversationId)
  );
  const setDraft = useChatStore((state) => state.setDraft);
  const setReplyTarget = useChatStore((state) => state.setReplyTarget);
  const setEditTarget = useChatStore((state) => state.setEditTarget);
  const sendOptimisticMessage = useChatStore((state) => state.sendOptimisticMessage);
  const confirmSentMessage = useChatStore((state) => state.confirmSentMessage);
  const markMessageFailed = useChatStore((state) => state.markMessageFailed);
  const mergeRemoteMessage = useChatStore((state) => state.mergeRemoteMessage);

  const { draft, replyTargetId: replyingToId, editTargetId: editingMessageId } =
    composer;
  const trimmedDraft = draft.trim();
  const canSend = trimmedDraft.length > 0;
  const replyingTo = useMemo(
    () =>
      replyingToId
        ? messages.find((message) => message.id === replyingToId) ?? null
        : null,
    [messages, replyingToId]
  );
  const editingMessage = useMemo(
    () =>
      editingMessageId
        ? messages.find((message) => message.id === editingMessageId) ?? null
        : null,
    [editingMessageId, messages]
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
    clearComposer = false
  ) {
    setNotice(null);
    stopLocalTyping();

    const optimistic: LocalMessage = {
      id: clientRequestId,
      conversationId: chat.conversationId,
      senderId: chat.currentUserId,
      senderRole: chat.currentUserRole,
      senderDisplayName: chat.currentUserDisplayName,
      body,
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
    }

    const result = await sendMessageAction({
      conversationId: chat.conversationId,
      body,
      clientRequestId,
      replyToMessageId,
    }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That did not send yet. Keep this open and try again.",
    }));

    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That did not send yet. Keep this open and try again.");
      markMessageFailed(
        chat.conversationId,
        clientRequestId,
        result.notice ?? "Not sent yet"
      );
      if (clearComposer) {
        setDraft(chat.conversationId, "");
      }
      return;
    }

    const sentMessage = result.message;
    confirmSentMessage(sentMessage, clientRequestId);
  }

  async function handleEditMessage(body: string) {
    if (!editingMessageId || !editMessageAction) {
      return;
    }

    setNotice(null);
    const result = await editMessageAction({
      messageId: editingMessageId,
      body,
    }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That did not save yet. Keep this open and try again.",
    }));

    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That did not save yet. Keep this open and try again.");
      return;
    }

    mergeRemoteMessage(result.message!);
    setDraft(chat.conversationId, "");
    setEditTarget(chat.conversationId, null);
  }

  async function handleSend() {
    if (trimmedDraft.length === 0) {
      setNotice("Add a message before sending.");
      return;
    }

    if (trimmedDraft.length > chatLimits.messageBodyMaxLength) {
      setNotice("This message is a little long. Try sending it in two parts.");
      return;
    }

    if (editingMessageId) {
      await handleEditMessage(trimmedDraft);
      return;
    }

    await sendWithRequestId(trimmedDraft, makeRequestId(), replyingToId, true);
  }

  async function handleDeleteMessage(message: LocalMessage) {
    if (!deleteMessageAction) {
      setNotice("That action is not available yet.");
      return;
    }

    const result = await deleteMessageAction({ messageId: message.id }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That did not delete yet. Keep this open and try again.",
    }));
    if (result.status !== "sent" || !result.message) {
      setNotice(result.notice ?? "That did not delete yet. Keep this open and try again.");
      return;
    }

    mergeRemoteMessage(result.message!);
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

  function startReplyingToMessage(message: LocalMessage) {
    setReplyTarget(chat.conversationId, message.id);
    setEditTarget(chat.conversationId, null);
    setNotice(null);
  }

  function startEditingMessage(message: LocalMessage) {
    setEditTarget(chat.conversationId, message.id);
    setReplyTarget(chat.conversationId, null);
    setDraft(chat.conversationId, message.body);
    setNotice(null);
  }

  function cancelReply() {
    setReplyTarget(chat.conversationId, null);
  }

  function cancelEdit() {
    setEditTarget(chat.conversationId, null);
    setDraft(chat.conversationId, "");
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void handleSend();
  }

  return {
    draft,
    notice,
    canSend,
    replyingTo,
    editingMessage,
    handleDraftChange,
    handleSend,
    sendWithRequestId,
    handleDeleteMessage,
    handleToggleReaction,
    startReplyingToMessage,
    startEditingMessage,
    cancelReply,
    cancelEdit,
    handleComposerKeyDown,
  };
}
