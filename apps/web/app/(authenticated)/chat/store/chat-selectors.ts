import type {
  ChatComposerState,
  ChatConversationId,
  ChatConversationState,
  ChatMessageState,
  ChatReadState,
  RealtimeConnectionState,
} from "@fish/core/chat-state";
import type { ChatStoreState } from "./chat-store";

const emptyComposer: ChatComposerState = {
  draft: "",
  replyTargetId: null,
  editTargetId: null,
};

// Selectors run as useSyncExternalStore snapshots (zustand v5): fallbacks must
// be referentially stable or React's getServerSnapshot loop guard fires on SSR.
const emptyMessages: ChatMessageState[] = [];
const emptyReadStates: ChatReadState[] = [];

export function selectConversationState(
  state: Pick<ChatStoreState, "conversations">,
  conversationId: ChatConversationId
): ChatConversationState | null {
  return state.conversations[conversationId] ?? null;
}

export function selectMessagesForConversation(
  state: Pick<ChatStoreState, "conversations">,
  conversationId: ChatConversationId
): ChatMessageState[] {
  return selectConversationState(state, conversationId)?.messages ?? emptyMessages;
}

export function selectHydrationKeyForConversation(
  state: Pick<ChatStoreState, "hydrationKeys">,
  conversationId: ChatConversationId
): string | null {
  return state.hydrationKeys[conversationId] ?? null;
}

export function selectComposerForConversation(
  state: Pick<ChatStoreState, "conversations">,
  conversationId: ChatConversationId
): ChatComposerState {
  return selectConversationState(state, conversationId)?.composer ?? emptyComposer;
}

export function selectReadStatesForConversation(
  state: Pick<ChatStoreState, "conversations">,
  conversationId: ChatConversationId
): ChatReadState[] {
  return (
    selectConversationState(state, conversationId)?.readStates ?? emptyReadStates
  );
}

export function selectRealtimeStatusForConversation(
  state: Pick<ChatStoreState, "conversations">,
  conversationId: ChatConversationId
): RealtimeConnectionState {
  return selectConversationState(state, conversationId)?.realtime.status ?? "idle";
}
