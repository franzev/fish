import {
  reduceChatState,
  type ChatConversationId,
  type ChatEvent,
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
  dispatchChatEvent: (event: ChatEvent) => void;
  hydrateConversation: (
    conversationId: ChatConversationId,
    messages: ChatMessageState[],
    readStates: ChatReadState[]
  ) => void;
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
    dispatchChatEvent,
    hydrateConversation: (conversationId, messages, readStates) => {
      dispatchChatEvent({
        type: "hydrateConversation",
        conversationId,
        messages,
        readStates,
      });
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
        const { [conversationId]: _removed, ...conversations } =
          state.conversations;
        return { conversations };
      });
    },
  };
}

export function createChatStore() {
  return createStore<ChatStoreState>()((set) => createChatStoreState(set));
}

export const chatStore = createChatStore();

export function useChatStore(): ChatStoreState;
export function useChatStore<T>(selector: (state: ChatStoreState) => T): T;
export function useChatStore<T>(
  selector?: (state: ChatStoreState) => T
): ChatStoreState | T {
  if (selector) {
    return useStore(chatStore, selector);
  }

  return useStore(chatStore);
}

export function resetChatStoreForTests() {
  chatStore.setState(createChatStoreState(chatStore.setState), true);
}
