import type {
  ChatComposerState,
  ChatConversationId,
  ChatConversationState,
  ChatEvent,
  ChatMessageState,
  ChatPaginationState,
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

const defaultPagination: ChatPaginationState = {
  oldestLoadedCursor: null,
  hasMoreOlder: false,
  isLoadingOlder: false,
  hasLoadError: false,
};

export function createEmptyChatState(): ChatState {
  return { conversations: {} };
}

export function applyChatEvents(state: ChatState, events: ChatEvent[]): ChatState {
  return events.reduce((next, event) => reduceChatState(next, event), state);
}

export function reduceChatState(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case "hydrateConversation": {
      const conversation = getConversation(state, event.conversationId);
      const incoming = event.messages.map((message) =>
        normalizeMessage(message, "sent")
      );
      return setConversation(state, {
        ...conversation,
        conversationId: event.conversationId,
        messages: mergeHydratedMessages(conversation.messages, incoming),
        readStates: event.readStates,
      });
    }

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
      return updateConversation(state, event.conversationId, (conversation) => {
        const readStates = mergeReadStateList(
          conversation.readStates,
          event.readState
        );
        if (readStates === conversation.readStates) {
          return conversation;
        }

        return {
          ...conversation,
          readStates,
        };
      });

    case "composerGifSelected":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        composer: {
          ...conversation.composer,
          selectedGif: event.gif,
          selectedGifQuery: event.query,
          selectedStickerId: null,
          selectionRevision: (conversation.composer.selectionRevision ?? 0) + 1,
        },
      }));

    case "composerStickerSelected":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        composer: {
          ...conversation.composer,
          selectedGif: null,
          selectedGifQuery: "",
          selectedStickerId: event.stickerId,
          selectionRevision: (conversation.composer.selectionRevision ?? 0) + 1,
        },
      }));

    case "composerSelectionCleared":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        composer: {
          ...conversation.composer,
          selectedGif: null,
          selectedGifQuery: "",
          selectedStickerId: null,
          selectionRevision: (conversation.composer.selectionRevision ?? 0) + 1,
        },
      }));

    case "deleteRequested":
      return updateConversation(state, event.conversationId, (conversation) => {
        const message = conversation.messages.find((item) => item.id === event.messageId);
        if (!message) return conversation;

        return {
          ...conversation,
          messages: conversation.messages.map((item) =>
            item.id === event.messageId ? { ...item, deletedAt: event.at } : item
          ),
          composer: {
            ...conversation.composer,
            pendingDeleteByMessageId: {
              ...conversation.composer.pendingDeleteByMessageId,
              [event.messageId]: event.at,
            },
          },
        };
      });

    case "deleteFailed":
      return updateConversation(state, event.conversationId, (conversation) => {
        const pendingAt = conversation.composer.pendingDeleteByMessageId?.[event.messageId];
        if (!pendingAt) return conversation;

        const message = conversation.messages.find((item) => item.id === event.messageId);
        const pendingDeletes = { ...conversation.composer.pendingDeleteByMessageId };
        delete pendingDeletes[event.messageId];
        const composer = {
          ...conversation.composer,
          pendingDeleteByMessageId: Object.keys(pendingDeletes).length > 0
            ? pendingDeletes
            : undefined,
        };
        if (!message || message.deletedAt !== pendingAt) {
          return { ...conversation, composer };
        }

        return {
          ...conversation,
          messages: conversation.messages.map((item) =>
            item.id === event.messageId ? { ...item, deletedAt: null } : item
          ),
          composer,
        };
      });

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
      return updateConversation(state, event.conversationId, (conversation) => {
        if (conversation.realtime.status === event.status) {
          return conversation;
        }

        return {
          ...conversation,
          realtime: { status: event.status },
        };
      });

    case "clearComposer":
      return updateConversation(state, event.conversationId, (conversation) => ({
        ...conversation,
        composer: { ...emptyComposer },
      }));

    case "hydrateWindow": {
      const conversation = getConversation(state, event.conversationId);
      const incoming = event.messages.map((message) =>
        normalizeMessage(message, "sent")
      );
      return setConversation(state, {
        ...conversation,
        conversationId: event.conversationId,
        messages: mergeHydratedMessages(conversation.messages, incoming),
        readStates: event.readStates,
        pagination: {
          oldestLoadedCursor: event.oldestCursor,
          hasMoreOlder: event.hasMoreOlder,
          isLoadingOlder: false,
          hasLoadError: false,
        },
      });
    }

    case "olderMessagesRequested":
      return updateConversation(state, event.conversationId, (conversation) => {
        if (conversation.pagination.isLoadingOlder) {
          return conversation;
        }

        return {
          ...conversation,
          // A new request atomically clears any prior failure so a retry
          // starts from a clean pagination-feedback state.
          pagination: {
            ...conversation.pagination,
            isLoadingOlder: true,
            hasLoadError: false,
          },
        };
      });

    case "olderPageLoaded":
      return updateConversation(state, event.conversationId, (conversation) => {
        const messages = event.messages.reduce(
          (current, message) =>
            mergeChatMessage(current, normalizeMessage(message, "sent")),
          conversation.messages
        );

        return {
          ...conversation,
          messages,
          pagination: {
            oldestLoadedCursor: event.oldestCursor,
            hasMoreOlder: event.hasMoreOlder,
            isLoadingOlder: false,
            hasLoadError: false,
          },
        };
      });

    case "olderPageLoadFailed":
      return updateConversation(state, event.conversationId, (conversation) => {
        if (!conversation.pagination.isLoadingOlder) {
          return conversation;
        }

        // hasMoreOlder/oldestLoadedCursor are left untouched so a retry
        // (dispatching olderMessagesRequested again) is still possible.
        // hasLoadError commits in this SAME update, atomically with
        // isLoadingOlder=false, so there is no intermediate render where
        // loading is false but the failure hasn't landed yet — that gap
        // was what let the IntersectionObserver re-attach and fire a
        // second automatic request (older-load-double-retry.md).
        return {
          ...conversation,
          pagination: {
            ...conversation.pagination,
            isLoadingOlder: false,
            hasLoadError: true,
          },
        };
      });
  }
}

function mergeMessage(
  state: ChatState,
  message: ChatMessageState,
  localRequestId = message.clientRequestId
): ChatState {
  return updateConversation(state, message.conversationId, (conversation) => {
    const messages = mergeChatMessage(
      conversation.messages,
      message,
      localRequestId
    );
    if (messages === conversation.messages && !message.deletedAt) {
      return conversation;
    }

    const pendingDeletes = { ...conversation.composer.pendingDeleteByMessageId };
    if (message.deletedAt) delete pendingDeletes[message.id];
    return {
      ...conversation,
      messages,
      composer: message.deletedAt
        ? {
            ...conversation.composer,
            pendingDeleteByMessageId: Object.keys(pendingDeletes).length > 0
              ? pendingDeletes
              : undefined,
          }
        : conversation.composer,
    };
  });
}

// A hydrate/reconnect snapshot is authoritative for everything it reports,
// but it cannot know about a local send the server hasn't accepted (or the
// client hasn't retried) yet. Dropping that row would delete the only copy
// of its body, leaving a later failure with nothing left to restore into
// the composer (WR-02). Preserve unresolved local rows, then fold the
// authoritative snapshot on top through the same merge primitive
// olderPageLoaded uses, so a matching authoritative row (by id or
// clientRequestId) always supersedes the local placeholder instead of
// duplicating it.
function mergeHydratedMessages(
  existingMessages: ChatMessageState[],
  incomingMessages: ChatMessageState[]
): ChatMessageState[] {
  const unresolved = existingMessages.filter(
    (message) =>
      message.localStatus === "pending" ||
      message.localStatus === "sending" ||
      message.localStatus === "failed"
  );

  return incomingMessages
    .reduce((current, message) => mergeChatMessage(current, message), unresolved)
    .sort(compareChatMessages);
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

    // Monotonic status guard: once a message is confirmed "sent" (by the
    // authoritative send response or a realtime/hydrate reconciliation), a
    // later-arriving failure for the same clientRequestId must never
    // downgrade it back to "failed" — the message really did go out. Without
    // this guard a stale failure callback racing behind a faster
    // confirmation could relabel a delivered message as failed (WR-03).
    if (failedMessage?.localStatus === "sent") {
      return conversation;
    }

    // Only restore the failed body when nothing newer was typed while the
    // send was pending. A non-empty draft is a newer edit typed during the
    // in-flight send and must survive a (possibly delayed) failure
    // untouched — no lost drafts (CSTATE-06).
    const shouldRestoreDraft = conversation.composer.draft.length === 0;

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
        draft: shouldRestoreDraft
          ? failedMessage?.body ?? conversation.composer.draft
          : conversation.composer.draft,
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
  const nextConversation = update(conversation);
  return nextConversation === conversation
    ? state
    : setConversation(state, nextConversation);
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
      pagination: { ...defaultPagination },
    }
  );
}

export function normalizeMessage(
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
