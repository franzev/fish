import {
  reduceChatState,
  type ChatConversationId,
  type ChatEvent,
  type ChatMessageCursor,
  type ChatMessageId,
  type ChatMessageState,
  type ChatReadState,
  type ChatState,
  type RealtimeConnectionState,
} from "@fish/core/chat-state";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface ChatStoreState {
  conversations: ChatState["conversations"];
  hydrationKeys: Record<ChatConversationId, string>;
  dispatchChatEvent: (event: ChatEvent) => void;
  hydrateConversation: (
    conversationId: ChatConversationId,
    messages: ChatMessageState[],
    readStates: ChatReadState[],
    hydrationKey?: string
  ) => void;
  hydrateWindow: (
    conversationId: ChatConversationId,
    messages: ChatMessageState[],
    readStates: ChatReadState[],
    hasMoreOlder: boolean,
    oldestCursor: ChatMessageCursor | null,
    hydrationKey?: string
  ) => void;
  requestOlderMessages: (conversationId: ChatConversationId) => void;
  applyOlderPage: (
    conversationId: ChatConversationId,
    messages: ChatMessageState[],
    hasMoreOlder: boolean,
    oldestCursor: ChatMessageCursor | null
  ) => void;
  markOlderPageFailed: (conversationId: ChatConversationId) => void;
  sendOptimisticMessage: (message: ChatMessageState) => void;
  confirmSentMessage: (
    message: ChatMessageState,
    localRequestId?: string
  ) => void;
  markMessageFailed: (
    conversationId: ChatConversationId,
    clientRequestId: string,
    reason?: string
  ) => void;
  mergeRemoteMessage: (
    message: ChatMessageState,
    localRequestId?: string
  ) => void;
  mergeReadState: (
    conversationId: ChatConversationId,
    readState: ChatReadState
  ) => void;
  setDraft: (conversationId: ChatConversationId, draft: string) => void;
  setReplyTarget: (
    conversationId: ChatConversationId,
    messageId: ChatMessageId | null
  ) => void;
  setEditTarget: (
    conversationId: ChatConversationId,
    messageId: ChatMessageId | null
  ) => void;
  setRealtimeStatus: (
    conversationId: ChatConversationId,
    status: RealtimeConnectionState
  ) => void;
  clearComposer: (conversationId: ChatConversationId) => void;
  clearConversation: (conversationId: ChatConversationId) => void;
}

type ChatStoreSet = StoreApi<ChatStoreState>["setState"];

function createStateFromConversations(
  conversations: ChatState["conversations"]
): ChatState {
  return { conversations };
}

// Hashes only messages + read states. Pagination metadata (hasMoreOlder/
// oldestCursor) is derived server-side from the same SSR payload and always
// travels alongside it, so it needs no place of its own in this key — adding
// it here would not change when a re-entrant hydration should be treated as
// "already seen" (review MEDIUM 10-03).
export function createChatHydrationKey(
  messages: ChatMessageState[],
  readStates: ChatReadState[]
): string {
  return JSON.stringify({
    messages: messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      body: message.body,
      clientRequestId: message.clientRequestId,
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
      deletedAt: message.deletedAt ?? null,
      replyToMessageId: message.replyToMessageId ?? null,
      reactions: message.reactions ?? [],
      localStatus: message.localStatus,
    })),
    readStates: readStates.map((readState) => ({
      userId: readState.userId,
      lastDeliveredMessageId: readState.lastDeliveredMessageId ?? null,
      deliveredAt: readState.deliveredAt ?? null,
      lastReadMessageId: readState.lastReadMessageId ?? null,
      readAt: readState.readAt ?? null,
    })),
  });
}

function createChatStoreState(set: ChatStoreSet): ChatStoreState {
  const dispatchChatEvent = (event: ChatEvent) => {
    set((state) => ({
      conversations: reduceChatState(
        createStateFromConversations(state.conversations),
        event
      ).conversations,
    }));
  };

  return {
    conversations: {},
    hydrationKeys: {},
    dispatchChatEvent,
    hydrateConversation: (conversationId, messages, readStates, hydrationKey) => {
      set((state) => {
        const conversations = reduceChatState(
          createStateFromConversations(state.conversations),
          {
            type: "hydrateConversation",
            conversationId,
            messages,
            readStates,
          }
        ).conversations;

        if (hydrationKey === undefined) {
          return { conversations };
        }

        return {
          conversations,
          hydrationKeys: {
            ...state.hydrationKeys,
            [conversationId]: hydrationKey,
          },
        };
      });
    },
    hydrateWindow: (
      conversationId,
      messages,
      readStates,
      hasMoreOlder,
      oldestCursor,
      hydrationKey
    ) => {
      set((state) => {
        const conversations = reduceChatState(
          createStateFromConversations(state.conversations),
          {
            type: "hydrateWindow",
            conversationId,
            messages,
            readStates,
            hasMoreOlder,
            oldestCursor,
          }
        ).conversations;

        if (hydrationKey === undefined) {
          return { conversations };
        }

        return {
          conversations,
          hydrationKeys: {
            ...state.hydrationKeys,
            [conversationId]: hydrationKey,
          },
        };
      });
    },
    requestOlderMessages: (conversationId) => {
      dispatchChatEvent({ type: "olderMessagesRequested", conversationId });
    },
    applyOlderPage: (conversationId, messages, hasMoreOlder, oldestCursor) => {
      dispatchChatEvent({
        type: "olderPageLoaded",
        conversationId,
        messages,
        hasMoreOlder,
        oldestCursor,
      });
    },
    markOlderPageFailed: (conversationId) => {
      dispatchChatEvent({ type: "olderPageLoadFailed", conversationId });
    },
    sendOptimisticMessage: (message) => {
      dispatchChatEvent({ type: "sendOptimisticMessage", message });
    },
    confirmSentMessage: (message, localRequestId) => {
      dispatchChatEvent({ type: "confirmSentMessage", message, localRequestId });
    },
    markMessageFailed: (conversationId, clientRequestId, reason) => {
      dispatchChatEvent({
        type: "markMessageFailed",
        conversationId,
        clientRequestId,
        reason,
      });
    },
    mergeRemoteMessage: (message, localRequestId) => {
      dispatchChatEvent({ type: "mergeRemoteMessage", message, localRequestId });
    },
    mergeReadState: (conversationId, readState) => {
      dispatchChatEvent({ type: "mergeReadState", conversationId, readState });
    },
    setDraft: (conversationId, draft) => {
      dispatchChatEvent({ type: "draftChanged", conversationId, draft });
    },
    setReplyTarget: (conversationId, messageId) => {
      dispatchChatEvent({ type: "setReplyTarget", conversationId, messageId });
    },
    setEditTarget: (conversationId, messageId) => {
      dispatchChatEvent({ type: "setEditTarget", conversationId, messageId });
    },
    setRealtimeStatus: (conversationId, status) => {
      dispatchChatEvent({ type: "setRealtimeStatus", conversationId, status });
    },
    clearComposer: (conversationId) => {
      dispatchChatEvent({ type: "clearComposer", conversationId });
    },
    clearConversation: (conversationId) => {
      set((state) => {
        const conversations = { ...state.conversations };
        const hydrationKeys = { ...state.hydrationKeys };
        delete conversations[conversationId];
        delete hydrationKeys[conversationId];
        return { conversations, hydrationKeys };
      });
    },
  };
}

export function createChatStore() {
  return createStore<ChatStoreState>()((set) => createChatStoreState(set));
}

export const chatStore = createChatStore();

export function useChatStore<T>(selector: (state: ChatStoreState) => T): T {
  return useStore(chatStore, selector);
}

export function resetChatStoreForTests() {
  chatStore.setState(createChatStoreState(chatStore.setState), true);
}
