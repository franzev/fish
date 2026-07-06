import type {
  ChatComposerState,
  ChatConversationId,
  ChatConversationState,
  ChatEvent,
  ChatMessageState,
  ChatReadState,
  ChatState,
  LocalMessageStatus,
  RealtimeConnectionState,
} from "./types";
import {
  compareChatMessages,
  mergeChatMessage,
  mergeReadState as mergeReadStateList,
} from "./selectors";

const emptyComposer: ChatComposerState = {
  draft: "",
  replyTargetId: null,
  editTargetId: null,
};

const defaultRealtime: { status: RealtimeConnectionState } = {
  status: "idle",
};

export function createEmptyChatState(): ChatState {
  return { conversations: {} };
}

export function applyChatEvents(state: ChatState, events: ChatEvent[]): ChatState {
  return events.reduce((next, event) => reduceChatState(next, event), state);
}

export function reduceChatState(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case "hydrateConversation":
      return setConversation(state, {
        ...getConversation(state, event.conversationId),
        conversationId: event.conversationId,
        messages: event.messages
          .map((message) => normalizeMessage(message, "sent"))
          .sort(compareChatMessages),
        readStates: event.readStates,
      });

    case "draftChanged":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        composer: { ...conversation.composer, draft: event.draft },
      }));

    case "sendOptimisticMessage":
      return mergeMessage(state, normalizeMessage(event.message, "sending"));

    case "confirmSentMessage":
      return mergeMessage(
        state,
        normalizeMessage(stripFailure(event.message), "sent"),
        event.localRequestId
      );

    case "markMessageFailed":
      return markMessageFailed(
        state,
        event.conversationId,
        event.clientRequestId,
        event.reason
      );

    case "mergeRemoteMessage":
      return mergeMessage(
        state,
        normalizeMessage(stripFailure(event.message), "sent"),
        event.localRequestId
      );

    case "mergeReadState":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        readStates: mergeReadStateList(conversation.readStates, event.readState),
      }));

    case "setReplyTarget":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        composer: {
          ...conversation.composer,
          replyTargetId: event.messageId,
        },
      }));

    case "setEditTarget":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        composer: {
          ...conversation.composer,
          editTargetId: event.messageId,
        },
      }));

    case "setRealtimeStatus":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        realtime: { status: event.status },
      }));

    case "clearComposer":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        composer: { ...emptyComposer },
      }));
  }
}

function mergeMessage(
  state: ChatState,
  message: ChatMessageState,
  localRequestId = message.clientRequestId
): ChatState {
  return updateConversation(state, message.conversationId, (conversation) => ({
    ...conversation,
    messages: mergeChatMessage(conversation.messages, message, localRequestId),
  }));
}

function markMessageFailed(
  state: ChatState,
  conversationId: ChatConversationId,
  clientRequestId: string,
  reason?: string
): ChatState {
  return updateConversation(state, conversationId, (conversation) => {
    const failedMessage = conversation.messages.find(
      (message) => message.clientRequestId === clientRequestId
    );

    return {
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.clientRequestId === clientRequestId
          ? {
              ...message,
              localStatus: "failed",
              failureReason: reason ?? null,
            }
          : message
      ),
      composer: {
        ...conversation.composer,
        draft: failedMessage?.body ?? conversation.composer.draft,
      },
    };
  });
}

function updateConversation(
  state: ChatState,
  conversationId: ChatConversationId,
  update: (conversation: ChatConversationState) => ChatConversationState
): ChatState {
  const conversation = getConversation(state, conversationId);
  return setConversation(state, update(conversation));
}

function setConversation(
  state: ChatState,
  conversation: ChatConversationState
): ChatState {
  return {
    ...state,
    conversations: {
      ...state.conversations,
      [conversation.conversationId]: conversation,
    },
  };
}

function getConversation(
  state: ChatState,
  conversationId: ChatConversationId
): ChatConversationState {
  return (
    state.conversations[conversationId] ?? {
      conversationId,
      messages: [],
      readStates: [] satisfies ChatReadState[],
      composer: { ...emptyComposer },
      realtime: { ...defaultRealtime },
    }
  );
}

function normalizeMessage(
  message: ChatMessageState,
  localStatus: LocalMessageStatus
): ChatMessageState {
  return {
    ...message,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    replyToMessageId: message.replyToMessageId ?? null,
    reactions: message.reactions ?? [],
    localStatus,
  };
}

function stripFailure(message: ChatMessageState): ChatMessageState {
  const { failureReason: _failureReason, ...next } = message;
  return next;
}
