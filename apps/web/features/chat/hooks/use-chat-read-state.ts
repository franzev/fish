import type {
  ClientChatData,
  ClientChatReadState,
  ClientChatUnreadSummary,
} from "@/lib/services";
import type {
  MarkReadStateActionState,
  UnreadSummaryActionState,
} from "@/features/chat/contracts";
import {
  getUnreadMessageSummary,
  mergeReadState as mergeChatReadState,
} from "@/features/chat/model/chat-state";
import { toLocalMessage, type LocalMessage } from "./use-chat-messages";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  chatStore,
  createChatHydrationKey,
  useChatStore,
} from "@/features/chat/model/store";
import {
  selectHydrationKeyForConversation,
  selectReadStatesForConversation,
} from "@/features/chat/model/store";

const unreadSummaryRefreshDelayMs = 150;

interface UseChatReadStateOptions {
  chat: ClientChatData;
  messages: LocalMessage[];
  markReadStateAction?: (input: unknown) => Promise<MarkReadStateActionState>;
  refreshUnreadSummaryAction?: (
    input: unknown
  ) => Promise<UnreadSummaryActionState>;
}

interface ConversationUnreadState {
  conversationId: string;
  summary: ClientChatUnreadSummary;
  isMarking: boolean;
  notice: string | null;
}

function readStateForCurrentUser(
  conversationId: string,
  currentUserId: string
): ClientChatReadState | undefined {
  return (
    selectReadStatesForConversation(
      chatStore.getState(),
      conversationId
    ) as ClientChatReadState[]
  ).find((state) => state.userId === currentUserId);
}

function isEarlierTimestamp(
  incoming: string | null,
  current: string | null
): boolean {
  if (!current) return false;
  if (!incoming) return true;
  return Date.parse(incoming) < Date.parse(current);
}

function mergeMonotonicReadState(
  current: ClientChatReadState[],
  incoming: ClientChatReadState
): ClientChatReadState[] {
  const existing = current.find((state) => state.userId === incoming.userId);
  if (
    existing &&
    (isEarlierTimestamp(incoming.deliveredAt, existing.deliveredAt) ||
      isEarlierTimestamp(incoming.readAt, existing.readAt))
  ) {
    return current;
  }
  return mergeChatReadState(current, incoming);
}

export function useChatReadState({
  chat,
  messages,
  markReadStateAction,
  refreshUnreadSummaryAction,
}: UseChatReadStateOptions) {
  const storeReadStates = useChatStore((state) =>
    selectReadStatesForConversation(state, chat.conversationId)
  ) as ClientChatReadState[];
  const storedHydrationKey = useChatStore((state) =>
    selectHydrationKeyForConversation(state, chat.conversationId)
  );
  const mergeReadStateAction = useChatStore((state) => state.mergeReadState);
  const initialMessages = useMemo(
    () => chat.messages.map(toLocalMessage),
    [chat.messages]
  );
  const initialReadStates = useMemo(() => chat.readStates ?? [], [chat.readStates]);
  const hydrationKey = useMemo(
    () => createChatHydrationKey(initialMessages, initialReadStates),
    [initialMessages, initialReadStates]
  );
  const readStates =
    storedHydrationKey === hydrationKey ? storeReadStates : initialReadStates;

  const setReadStates = useCallback(
    (nextReadStates: ClientChatReadState[]) => {
      const messagesSnapshot =
        chatStore.getState().conversations[chat.conversationId]?.messages ?? [];
      chatStore
        .getState()
        .hydrateConversation(chat.conversationId, messagesSnapshot, nextReadStates);
    },
    [chat.conversationId]
  );

  const mergeReadState = useCallback((readState: ClientChatReadState) => {
    const current = selectReadStatesForConversation(
      chatStore.getState(),
      chat.conversationId
    ) as ClientChatReadState[];
    if (mergeMonotonicReadState(current, readState) !== current) {
      mergeReadStateAction(chat.conversationId, readState);
    }
  }, [chat.conversationId, mergeReadStateAction]);

  const mergeReadStates = useCallback((incoming: ClientChatReadState[]) => {
    const current = selectReadStatesForConversation(
      chatStore.getState(),
      chat.conversationId
    ) as ClientChatReadState[];
    setReadStates(
      incoming.reduce(mergeMonotonicReadState, current)
    );
  }, [chat.conversationId, setReadStates]);

  const currentUserReadState = useMemo(
    () => readStates.find((state) => state.userId === chat.currentUserId),
    [chat.currentUserId, readStates]
  );
  const participantReadState = useMemo(
    () => readStates.find((state) => state.userId === chat.participant.id),
    [chat.participant.id, readStates]
  );
  const loadedUnreadSummary = useMemo(
    () => getUnreadMessageSummary(messages, chat.currentUserId, currentUserReadState),
    [chat.currentUserId, currentUserReadState, messages]
  );
  const initialUnreadSummary = chat.unreadSummary ?? loadedUnreadSummary;
  const [unreadState, setUnreadState] = useState<ConversationUnreadState>(() => ({
    conversationId: chat.conversationId,
    summary: initialUnreadSummary,
    isMarking: false,
    notice: null,
  }));

  // A single mounted ChatClient can switch conversations during recovery or
  // navigation tests. Reset the transient operation state during render so no
  // frame can expose the previous conversation's unread banner or notice.
  if (unreadState.conversationId !== chat.conversationId) {
    setUnreadState({
      conversationId: chat.conversationId,
      summary: initialUnreadSummary,
      isMarking: false,
      notice: null,
    });
  }
  const activeUnreadState = unreadState.conversationId === chat.conversationId
    ? unreadState
    : {
        conversationId: chat.conversationId,
        summary: initialUnreadSummary,
        isMarking: false,
        notice: null,
      };

  const activeConversationIdRef = useRef(chat.conversationId);
  const summaryRequestRef = useRef(0);
  const deliveredRequestRef = useRef<{
    conversationId: string;
    messageId: string;
  } | null>(null);

  useEffect(() => {
    activeConversationIdRef.current = chat.conversationId;
    summaryRequestRef.current += 1;
    deliveredRequestRef.current = null;
  }, [chat.conversationId]);

  const updateUnreadSummary = useCallback((summary: ClientChatUnreadSummary) => {
    setUnreadState((current) =>
      current.conversationId === chat.conversationId
        ? { ...current, summary }
        : current
    );
  }, [chat.conversationId]);

  const refreshUnreadSummary = useCallback(async () => {
    const conversationId = chat.conversationId;
    const requestId = ++summaryRequestRef.current;
    if (!refreshUnreadSummaryAction) {
      const currentMessages =
        chatStore.getState().conversations[conversationId]?.messages ?? messages;
      const summary = getUnreadMessageSummary(
        currentMessages,
        chat.currentUserId,
        readStateForCurrentUser(conversationId, chat.currentUserId)
      );
      if (activeConversationIdRef.current === conversationId) {
        updateUnreadSummary(summary);
      }
      return summary;
    }

    const result = await refreshUnreadSummaryAction({ conversationId }).catch(
      () => null
    );
    if (
      activeConversationIdRef.current !== conversationId ||
      summaryRequestRef.current !== requestId ||
      result?.status !== "sent" ||
      !result.unreadSummary
    ) {
      return null;
    }
    updateUnreadSummary(result.unreadSummary);
    return result.unreadSummary;
  }, [
    chat.conversationId,
    chat.currentUserId,
    messages,
    refreshUnreadSummaryAction,
    updateUnreadSummary,
  ]);

  // The persisted transcript is available to this device once mounted, but
  // viewing it is not the same as explicitly acknowledging it. Advance only
  // the delivered marker here; the read marker moves from the banner action.
  useEffect(() => {
    if (!markReadStateAction) {
      return;
    }

    const latestIncomingMessage = [...messages]
      .reverse()
      .find((message) => message.senderId !== chat.currentUserId);
    if (
      !latestIncomingMessage ||
      currentUserReadState?.lastDeliveredMessageId === latestIncomingMessage.id ||
      (
        deliveredRequestRef.current?.conversationId === chat.conversationId &&
        deliveredRequestRef.current.messageId === latestIncomingMessage.id
      )
    ) {
      return;
    }

    const conversationId = chat.conversationId;
    deliveredRequestRef.current = {
      conversationId,
      messageId: latestIncomingMessage.id,
    };
    void markReadStateAction({
      conversationId,
      lastDeliveredMessageId: latestIncomingMessage.id,
      lastReadMessageId: null,
    })
      .then((result) => {
        if (
          activeConversationIdRef.current === conversationId &&
          result.status === "sent" &&
          result.readState
        ) {
          mergeReadState(result.readState);
        } else if (
          activeConversationIdRef.current === conversationId &&
          deliveredRequestRef.current?.messageId === latestIncomingMessage.id
        ) {
          deliveredRequestRef.current = null;
        }
      })
      .catch(() => {
        if (
          activeConversationIdRef.current === conversationId &&
          deliveredRequestRef.current?.messageId === latestIncomingMessage.id
        ) {
          deliveredRequestRef.current = null;
        }
      });
  }, [
    chat.conversationId,
    chat.currentUserId,
    currentUserReadState?.lastDeliveredMessageId,
    markReadStateAction,
    mergeReadState,
    messages,
  ]);

  const unreadInputsSignature = useMemo(
    () => [
      currentUserReadState?.lastReadMessageId ?? "",
      ...messages
        .filter((message) => message.senderId !== chat.currentUserId)
        .map((message) => `${message.id}:${message.deletedAt ?? ""}`),
    ].join("|"),
    [chat.currentUserId, currentUserReadState?.lastReadMessageId, messages]
  );
  const previousUnreadInputsRef = useRef({
    conversationId: chat.conversationId,
    signature: unreadInputsSignature,
  });
  useEffect(() => {
    const previous = previousUnreadInputsRef.current;
    previousUnreadInputsRef.current = {
      conversationId: chat.conversationId,
      signature: unreadInputsSignature,
    };
    if (
      previous.conversationId !== chat.conversationId ||
      previous.signature === unreadInputsSignature
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      void refreshUnreadSummary();
    }, unreadSummaryRefreshDelayMs);
    return () => clearTimeout(timeout);
  }, [chat.conversationId, refreshUnreadSummary, unreadInputsSignature]);

  const markUnreadMessagesRead = useCallback(async () => {
    const conversationId = chat.conversationId;
    const previousSummary = activeUnreadState.summary;
    const targetMessageId = previousSummary.latestUnreadMessageId;
    if (!markReadStateAction || !targetMessageId || activeUnreadState.isMarking) {
      return;
    }

    setUnreadState((current) =>
      current.conversationId === conversationId
        ? {
            ...current,
            isMarking: true,
            notice: null,
          }
        : current
    );

    const result = await markReadStateAction({
      conversationId,
      lastDeliveredMessageId: targetMessageId,
      lastReadMessageId: targetMessageId,
    }).catch(() => null);
    if (activeConversationIdRef.current !== conversationId) {
      return;
    }

    if (result?.status !== "sent" || !result.readState) {
      setUnreadState((current) =>
        current.conversationId === conversationId
          ? {
              ...current,
              summary:
                current.summary.count > 0 ? current.summary : previousSummary,
              isMarking: false,
              notice: "Messages weren’t marked as read. Try again.",
            }
          : current
      );
      return;
    }

    mergeReadState(result.readState);
    const currentMessages =
      chatStore.getState().conversations[conversationId]?.messages ?? messages;
    const localSummary = getUnreadMessageSummary(
      currentMessages,
      chat.currentUserId,
      result.readState
    );
    setUnreadState((current) =>
      current.conversationId === conversationId
        ? {
            ...current,
            summary: localSummary,
            isMarking: false,
            notice: null,
          }
        : current
    );
    void refreshUnreadSummary();
  }, [
    activeUnreadState.isMarking,
    activeUnreadState.summary,
    chat.conversationId,
    chat.currentUserId,
    markReadStateAction,
    mergeReadState,
    messages,
    refreshUnreadSummary,
  ]);

  return {
    readStates,
    setReadStates,
    mergeReadState,
    mergeReadStates,
    currentUserReadState,
    participantReadState,
    unreadSummary: activeUnreadState.summary,
    unreadNotice: activeUnreadState.notice,
    unreadPending: activeUnreadState.isMarking,
    markUnreadMessagesRead,
  };
}
