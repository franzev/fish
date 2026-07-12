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
      gif: message.gif ?? null,
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

// Cache-partition fingerprint (CR-01). Module-level -- NOT a field of
// ChatStoreState -- so it can never surface in getState() or trip the "chat
// store authority boundary" test's forbidden-key list. It exists ONLY to
// decide when to purge stale local cache on a verified-identity change; it
// is never consulted for authorization, and RLS/Edge Functions remain the
// sole authority (D-05, D-08).
let cacheOwnerUserId: string | null = null;

// Full singleton reset for production sign-out (CR-01): logout is a soft
// `router.push`, so the JS module and this Zustand singleton survive across
// accounts in the same tab. A full replace (not a merge) empties every
// conversation's composer draft, pending/failed local messages, read state,
// and hydration key so the next signed-in account starts clean. Also forgets
// the cache owner so a later ensureChatStoreOwner() re-adopts from scratch.
export function clearChatStore(): void {
  chatStore.setState(createChatStoreState(chatStore.setState), true);
  cacheOwnerUserId = null;
}

// Purges the cache the moment the verified user changes (CR-01), covering
// non-button account transitions on the same tab -- e.g. a server re-render
// after a different account signs in without ever touching LogoutButton. A
// fresh store (no owner yet) or a repeated call for the SAME owner is a
// no-op beyond re-affirming ownership; existing state is never purged just
// because the guard mounts or re-renders.
export function ensureChatStoreOwner(userId: string): void {
  if (cacheOwnerUserId !== null && cacheOwnerUserId !== userId) {
    clearChatStore();
  }
  cacheOwnerUserId = userId;
}

export function resetChatStoreForTests() {
  clearChatStore();
}
