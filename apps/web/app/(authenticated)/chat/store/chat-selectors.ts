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
  return selectConversationState(state, conversationId)?.messages ?? [];
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
  return selectConversationState(state, conversationId)?.readStates ?? [];
}

export function selectRealtimeStatusForConversation(
  state: Pick<ChatStoreState, "conversations">,
  conversationId: ChatConversationId
): RealtimeConnectionState {
  return selectConversationState(state, conversationId)?.realtime.status ?? "idle";
}
