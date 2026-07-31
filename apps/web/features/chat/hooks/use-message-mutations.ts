import { chatLimits } from "@fish/core/chat";
import type { ClientChatData } from "@/lib/services";
import type {
  PinnedMessageActionState,
  ReportGifActionState,
  SendMessageActionState,
} from "@/features/chat/contracts";
import type { ChatPinState } from "@/features/chat/model/store";
import type { LocalMessage } from "./use-chat-messages";
import {
  chatStore,
  selectMessagesForConversation,
} from "@/features/chat/model/store";
import { useEffect, useRef, useState } from "react";

interface EditSessionState {
  conversationId: string;
  messageId: string;
  draft: string;
  notice: string | null;
  saving: boolean;
}

export interface MessageMutationResult {
  ok: boolean;
  notice?: string;
}

interface UseMessageMutationsOptions {
  chat: ClientChatData;
  messages: LocalMessage[];
  editMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  deleteMessageAction?: (input: unknown) => Promise<SendMessageActionState>;
  setReactionAction?: (input: unknown) => Promise<SendMessageActionState>;
  reportGifAction?: (input: unknown) => Promise<ReportGifActionState>;
  setPinnedMessageAction?: (input: unknown) => Promise<PinnedMessageActionState>;
  setReplyTarget: (conversationId: string, messageId: string | null) => void;
  setNotice: (notice: string | null) => void;
  mergeRemoteMessage: (message: LocalMessage) => void;
  requestDelete: (conversationId: string, messageId: string, at: string) => void;
  failDelete: (conversationId: string, messageId: string) => void;
  pinnedMessage: ChatPinState | null;
  setPinnedMessage: (pin: ChatPinState | null) => void;
}

const deleteRollbackNotice = "That message is still here. Try deleting it again.";
const pinRollbackNotice = "That pin did not save yet. Keep this open and try again.";

function deletionFailureNotice(notice?: string): string {
  const normalized = notice?.trim();
  return !normalized || normalized.toLowerCase().includes("keep this open")
    ? deleteRollbackNotice
    : normalized;
}

export function useMessageMutations({
  chat,
  messages,
  editMessageAction,
  deleteMessageAction,
  setReactionAction,
  reportGifAction,
  setPinnedMessageAction,
  setReplyTarget,
  setNotice,
  mergeRemoteMessage,
  requestDelete,
  failDelete,
  pinnedMessage,
  setPinnedMessage,
}: UseMessageMutationsOptions) {
  const [editSession, setEditSession] = useState<EditSessionState | null>(null);
  const [pendingReactionMessageIds, setPendingReactionMessageIds] = useState<Set<string>>(
    () => new Set()
  );
  const pendingReactionMessageIdsRef = useRef(new Set<string>());
  const [pendingPinMessageId, setPendingPinMessageId] = useState<string | null>(null);
  const activeConversationIdRef = useRef(chat.conversationId);
  useEffect(() => {
    activeConversationIdRef.current = chat.conversationId;
  }, [chat.conversationId]);

  const activeEdit = editSession?.conversationId === chat.conversationId ? editSession : null;
  const editingMessage = activeEdit
    ? messages.find((message) => message.id === activeEdit.messageId && !message.deletedAt) ?? null
    : null;

  async function handleSaveEdit() {
    if (!activeEdit) return;
    const body = activeEdit.draft.trim();
    if (body.length === 0) {
      setEditSession((current) => current ? { ...current, notice: "Add some text before saving." } : current);
      return;
    }
    if (body.length > chatLimits.messageBodyMaxLength) {
      setEditSession((current) => current ? { ...current, notice: "This message is a little long. Try shortening it." } : current);
      return;
    }
    if (!editMessageAction) {
      setEditSession((current) => current ? { ...current, notice: "Editing is not available yet." } : current);
      return;
    }

    const editingMessageId = activeEdit.messageId;
    setEditSession((current) => current?.messageId === editingMessageId
      ? { ...current, notice: null, saving: true }
      : current);
    const result = await editMessageAction({ messageId: editingMessageId, body }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: "That didn’t save yet. Your changes are still here. Try again.",
    }));
    if (result.status !== "sent" || !result.message) {
      setEditSession((current) => current?.messageId === editingMessageId
        ? { ...current, saving: false, notice: result.notice ?? "That didn’t save yet. Your changes are still here. Try again." }
        : current);
      return;
    }
    mergeRemoteMessage(result.message as LocalMessage);
    setEditSession((current) => current?.messageId === editingMessageId ? null : current);
  }

  async function handleDeleteMessage(message: LocalMessage): Promise<MessageMutationResult> {
    if (!deleteMessageAction) return { ok: false, notice: "Deleting is not available yet." };
    setNotice(null);
    const deletedAt = new Date().toISOString();
    requestDelete(message.conversationId, message.id, deletedAt);
    const result = await deleteMessageAction({ messageId: message.id }).catch(() => ({
      status: "notice" as const,
      values: {},
      notice: deleteRollbackNotice,
    }));
    if (result.status !== "sent" || !result.message) {
      failDelete(message.conversationId, message.id);
      const afterFailure = selectMessagesForConversation(chatStore.getState(), message.conversationId)
        .find((item) => item.id === message.id);
      if (afterFailure?.deletedAt) return { ok: true };
      const notice = deletionFailureNotice(result.notice);
      if (activeConversationIdRef.current === message.conversationId) setNotice(notice);
      return { ok: false, notice };
    }
    mergeRemoteMessage(result.message as LocalMessage);
    return { ok: true };
  }

  async function handleToggleReaction(message: LocalMessage, emoji: string) {
    if (pendingReactionMessageIdsRef.current.has(message.id)) return;
    if (!setReactionAction) {
      setNotice("That reaction did not save yet. Keep this open and try again.");
      return;
    }
    const active = !message.reactions?.some(
      (reaction) => reaction.emoji === emoji && reaction.byMe
    );
    pendingReactionMessageIdsRef.current.add(message.id);
    setPendingReactionMessageIds(new Set(pendingReactionMessageIdsRef.current));
    try {
      const result = await setReactionAction({
        messageId: message.id,
        emoji,
        active,
      }).catch(() => ({
        status: "notice" as const,
        values: {},
        notice: "That reaction did not save yet. Keep this open and try again.",
      }));
      if (result.status !== "sent" || !result.message) {
        setNotice(result.notice ?? "That reaction did not save yet. Keep this open and try again.");
        return;
      }
      mergeRemoteMessage(result.message as LocalMessage);
    } finally {
      pendingReactionMessageIdsRef.current.delete(message.id);
      setPendingReactionMessageIds(new Set(pendingReactionMessageIdsRef.current));
    }
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
    setNotice(result.status === "sent" ? "Thanks. This GIF was reported." : result.notice ?? "That report did not send yet. Try again.");
  }

  async function handleTogglePin(message: LocalMessage): Promise<MessageMutationResult> {
    if (pendingPinMessageId) return { ok: false, notice: pinRollbackNotice };
    if (!setPinnedMessageAction) {
      return { ok: false, notice: "Pinning is not available yet." };
    }
    setNotice(null);
    const wasPinned = pinnedMessage?.messageId === message.id;
    const previousPin = pinnedMessage;
    setPendingPinMessageId(message.id);
    setPinnedMessage(
      wasPinned
        ? null
        : { messageId: message.id, pinnedBy: chat.currentUserId, pinnedAt: new Date().toISOString() }
    );
    try {
      const result = await setPinnedMessageAction({
        conversationId: chat.conversationId,
        messageId: wasPinned ? null : message.id,
      }).catch(() => ({
        status: "notice" as const,
        values: {},
        notice: pinRollbackNotice,
      }));
      if (result.status !== "sent") {
        setPinnedMessage(previousPin);
        const notice = result.notice ?? pinRollbackNotice;
        setNotice(notice);
        return { ok: false, notice };
      }
      setPinnedMessage(result.pin ?? null);
      return { ok: true };
    } finally {
      setPendingPinMessageId((current) => (current === message.id ? null : current));
    }
  }

  function startEditingMessage(message: LocalMessage) {
    setReplyTarget(chat.conversationId, null);
    setEditSession({ conversationId: chat.conversationId, messageId: message.id, draft: message.body, notice: null, saving: false });
    setNotice(null);
  }

  function handleEditDraftChange(value: string) {
    setEditSession((current) => current?.conversationId === chat.conversationId
      ? { ...current, draft: value, notice: null }
      : current);
  }

  function cancelEdit() {
    setEditSession((current) => current?.conversationId === chat.conversationId ? null : current);
  }

  return {
    editingMessage,
    editDraft: activeEdit?.draft ?? "",
    editNotice: activeEdit?.notice ?? null,
    isSavingEdit: activeEdit?.saving ?? false,
    handleDeleteMessage,
    handleToggleReaction,
    isReactionPending: (messageId: string) => pendingReactionMessageIds.has(messageId),
    handleReportGif,
    handleTogglePin,
    isPinPending: (messageId: string) => pendingPinMessageId === messageId,
    startEditingMessage,
    handleEditDraftChange,
    handleSaveEdit,
    cancelEdit,
  };
}
