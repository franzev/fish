import type { ClientChatData, ClientChatMessage } from "@/lib/services";
import type { ChatConversationId, ChatMessageState } from "@fish/core/chat-state";
import { mergeChatMessage } from "@/features/chat/model/chat-state";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  chatStore,
  createChatHydrationKey,
  useChatStore,
} from "@/features/chat/model/store";
import {
  selectHasLoadErrorForConversation,
  selectHasMoreOlderForConversation,
  selectHydrationKeyForConversation,
  selectIsLoadingOlderForConversation,
  selectMessagesForConversation,
  selectOldestCursorForConversation,
  selectReadStatesForConversation,
} from "@/features/chat/model/store";

export type LocalStatus = "pending" | "sending" | "sent" | "failed";

export type LocalMessage = ClientChatMessage & {
  localStatus: LocalStatus;
};

export interface RefreshMessagesActionState {
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  messages?: ClientChatMessage[];
}

export interface RefreshConversationActionState extends RefreshMessagesActionState {
  readStates?: ClientChatData["readStates"];
}

// Shared shape for the three bounded pagination/backfill/reset reads (Plan
// 10-02): each action only ever populates the subset of these optional
// fields it actually returns, so one superset interface covers all three
// injected props below without three near-identical interfaces.
export interface LoadOlderMessagesActionState extends RefreshMessagesActionState {
  hasMoreOlder?: boolean;
  needsReset?: boolean;
  oldestCursor?: { createdAt: string; id: string } | null;
  readStates?: ClientChatData["readStates"];
}

export type LoadOlderMessagesOutcome = "loaded" | "failed" | "skipped";

const refreshMessageCooldownMs = 2_000;

export function toLocalMessage(message: ClientChatMessage): LocalMessage {
  return {
    ...message,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    replyToMessageId: message.replyToMessageId ?? null,
    reactions: message.reactions ?? [],
    localStatus: "sent",
  };
}

export function mergeMessage(
  current: LocalMessage[],
  incomingMessage: ClientChatMessage,
  localRequestId = incomingMessage.clientRequestId
): LocalMessage[] {
  return mergeChatMessage(current, toLocalMessage(incomingMessage), localRequestId);
}

interface UseChatMessagesOptions {
  chat: ClientChatData;
  refreshMessagesAction?: (input: unknown) => Promise<RefreshMessagesActionState>;
  refreshConversationAction?: (
    input: unknown
  ) => Promise<RefreshConversationActionState>;
  loadOlderMessagesAction?: (input: unknown) => Promise<LoadOlderMessagesActionState>;
  backfillMessagesAction?: (input: unknown) => Promise<LoadOlderMessagesActionState>;
  loadNewestMessagesAction?: (input: unknown) => Promise<LoadOlderMessagesActionState>;
  onReadStatesRefreshed?: (readStates: NonNullable<ClientChatData["readStates"]>) => void;
}

export function useChatMessages({
  chat,
  refreshMessagesAction,
  refreshConversationAction,
  loadOlderMessagesAction,
  backfillMessagesAction,
  loadNewestMessagesAction,
  onReadStatesRefreshed,
}: UseChatMessagesOptions) {
  const storeMessages = useChatStore((state) =>
    selectMessagesForConversation(state, chat.conversationId)
  ) as LocalMessage[];
  const storedHydrationKey = useChatStore((state) =>
    selectHydrationKeyForConversation(state, chat.conversationId)
  );
  const hasMoreOlder = useChatStore((state) =>
    selectHasMoreOlderForConversation(state, chat.conversationId)
  );
  const isLoadingOlder = useChatStore((state) =>
    selectIsLoadingOlderForConversation(state, chat.conversationId)
  );
  const hasLoadError = useChatStore((state) =>
    selectHasLoadErrorForConversation(state, chat.conversationId)
  );
  const hydrateConversation = useChatStore((state) => state.hydrateConversation);
  const hydrateWindow = useChatStore((state) => state.hydrateWindow);
  const requestOlderMessages = useChatStore((state) => state.requestOlderMessages);
  const applyOlderPage = useChatStore((state) => state.applyOlderPage);
  const markOlderPageFailed = useChatStore((state) => state.markOlderPageFailed);
  const dispatchChatEvent = useChatStore((state) => state.dispatchChatEvent);
  const messageIdsRef = useRef<string[]>([]);
  const refreshingMessageIdsRef = useRef<Set<string>>(new Set());
  const lastMessageRefreshAtRef = useRef<Map<string, number>>(new Map());
  // Per-conversation in-flight lock. A single hook-wide boolean let an
  // in-flight load in conversation A block conversation B's first load (and
  // A's own reset silently unlock B) once the mounted client switched
  // conversations mid-request (WR-01).
  const loadingOlderConversationsRef = useRef<Set<ChatConversationId>>(
    new Set()
  );
  const initialMessages = useMemo(
    () => chat.messages.map(toLocalMessage),
    [chat.messages]
  );
  const initialReadStates = useMemo(() => chat.readStates ?? [], [chat.readStates]);
  const hydrationKey = useMemo(
    () => createChatHydrationKey(initialMessages, initialReadStates),
    [initialMessages, initialReadStates]
  );
  const messages =
    storedHydrationKey === hydrationKey ? storeMessages : initialMessages;

  useEffect(() => {
    hydrateWindow(
      chat.conversationId,
      initialMessages,
      initialReadStates,
      chat.hasMoreOlder ?? false,
      chat.oldestCursor ?? null,
      hydrationKey
    );
  }, [
    chat.conversationId,
    chat.hasMoreOlder,
    chat.oldestCursor,
    hydrateWindow,
    hydrationKey,
    initialMessages,
    initialReadStates,
  ]);

  const setMessages: Dispatch<SetStateAction<LocalMessage[]>> = useCallback(
    (nextMessages) => {
      const currentMessages = selectMessagesForConversation(
        chatStore.getState(),
        chat.conversationId
      ) as LocalMessage[];
      const readStates = selectReadStatesForConversation(
        chatStore.getState(),
        chat.conversationId
      );
      const resolvedMessages =
        typeof nextMessages === "function"
          ? nextMessages(currentMessages)
          : nextMessages;

      hydrateConversation(
        chat.conversationId,
        resolvedMessages as ChatMessageState[],
        readStates
      );
    },
    [chat.conversationId, hydrateConversation]
  );

  useEffect(() => {
    messageIdsRef.current = messages.map((message) => message.id);
  }, [messages]);

  const refreshMessages = useCallback(
    async (messageIds: string[]) => {
      if (!refreshMessagesAction || messageIds.length === 0) {
        return;
      }

      const now = Date.now();
      const idsToRefresh = Array.from(new Set(messageIds)).filter((messageId) => {
        if (refreshingMessageIdsRef.current.has(messageId)) {
          return false;
        }

        const lastRefreshAt = lastMessageRefreshAtRef.current.get(messageId) ?? 0;
        return now - lastRefreshAt >= refreshMessageCooldownMs;
      });

      if (idsToRefresh.length === 0) {
        return;
      }

      idsToRefresh.forEach((messageId) => {
        refreshingMessageIdsRef.current.add(messageId);
        lastMessageRefreshAtRef.current.set(messageId, now);
      });

      const result = await refreshMessagesAction({
        messageIds: idsToRefresh,
      })
        .catch(() => null)
        .finally(() => {
          idsToRefresh.forEach((messageId) => {
            refreshingMessageIdsRef.current.delete(messageId);
          });
        });

      if (result?.status === "sent" && result.messages) {
        for (const message of result.messages) {
          dispatchChatEvent({ type: "mergeRemoteMessage", message });
        }
      }
    },
    [dispatchChatEvent, refreshMessagesAction]
  );

  // Cursor-based "load earlier" page (CLOAD-03). Guarded by an in-flight ref
  // (same idiom as refreshingMessageIdsRef) so a second call while a load is
  // already running is a no-op, and returns a resolved promise so callers
  // (Plan 04) can restore scroll position only once the prepend has landed.
  const loadOlderMessages = useCallback(async (): Promise<LoadOlderMessagesOutcome> => {
    // Captured once so a late-settling request always reads/writes the
    // conversation it was started for, even if `chat.conversationId` (and
    // this closure) has since been replaced by a switch to another one.
    const requestConversationId = chat.conversationId;

    if (
      !loadOlderMessagesAction ||
      !hasMoreOlder ||
      loadingOlderConversationsRef.current.has(requestConversationId)
    ) {
      return "skipped";
    }

    loadingOlderConversationsRef.current.add(requestConversationId);
    requestOlderMessages(requestConversationId);

    try {
      const cursor = selectOldestCursorForConversation(
        chatStore.getState(),
        requestConversationId
      );

      const result = await loadOlderMessagesAction({
        conversationId: requestConversationId,
        cursor,
      }).catch(() => null);

      if (result?.status === "sent" && result.messages) {
        const oldestRow = result.messages[0];
        applyOlderPage(
          requestConversationId,
          result.messages,
          result.hasMoreOlder ?? false,
          oldestRow ? { createdAt: oldestRow.createdAt, id: oldestRow.id } : cursor
        );
        return "loaded";
      } else {
        markOlderPageFailed(requestConversationId);
        return "failed";
      }
    } finally {
      loadingOlderConversationsRef.current.delete(requestConversationId);
    }
  }, [
    applyOlderPage,
    chat.conversationId,
    hasMoreOlder,
    loadOlderMessagesAction,
    markOlderPageFailed,
    requestOlderMessages,
  ]);

  // Bounded reconnect gap-backfill (CLOAD-06). On a small gap, merges the
  // returned rows through the single mergeRemoteMessage path (same as a live
  // realtime insert). On needsReset (the gap exceeds the bound), it never
  // falls back to the unbounded refreshConversationAction — it resets to the
  // bounded newest window via loadNewestMessagesAction and re-hydrates
  // (review HIGH 10-03).
  const applyGapBackfill = useCallback(async (): Promise<void> => {
    if (!backfillMessagesAction) {
      return;
    }

    const hydrateNewestWindow = async (): Promise<void> => {
      if (!loadNewestMessagesAction) {
        return;
      }

      const resetResult = await loadNewestMessagesAction({
        conversationId: chat.conversationId,
      }).catch(() => null);

      if (resetResult?.status === "sent" && resetResult.messages) {
        hydrateWindow(
          chat.conversationId,
          resetResult.messages,
          resetResult.readStates ?? [],
          resetResult.hasMoreOlder ?? false,
          resetResult.oldestCursor ?? null
        );
      }
    };

    const currentMessages = selectMessagesForConversation(
      chatStore.getState(),
      chat.conversationId
    );
    let newestConfirmedMessage: ChatMessageState | undefined;
    for (let index = currentMessages.length - 1; index >= 0; index -= 1) {
      const candidate = currentMessages[index];
      if (candidate?.localStatus === "sent") {
        newestConfirmedMessage = candidate;
        break;
      }
    }

    if (!newestConfirmedMessage) {
      await hydrateNewestWindow();
      return;
    }

    const result = await backfillMessagesAction({
      conversationId: chat.conversationId,
      afterCreatedAt: newestConfirmedMessage.createdAt,
      afterMessageId: newestConfirmedMessage.id,
    }).catch(() => null);

    if (!result || result.status !== "sent") {
      return;
    }

    if (result.needsReset) {
      await hydrateNewestWindow();
      return;
    }

    if (result.messages) {
      for (const message of result.messages) {
        dispatchChatEvent({ type: "mergeRemoteMessage", message });
      }
    }
  }, [
    backfillMessagesAction,
    chat.conversationId,
    dispatchChatEvent,
    hydrateWindow,
    loadNewestMessagesAction,
  ]);

  const refreshConversation = useCallback(async () => {
    // The bounded backfill is preferred whenever it's wired; the full
    // conversation refetch below is kept ONLY as a deep fallback for callers
    // that have not injected backfillMessagesAction yet (review Suggestion
    // 10-03) — reconnect no longer calls it in the normal path.
    if (backfillMessagesAction) {
      await applyGapBackfill();
      return;
    }

    if (!refreshConversationAction) {
      void refreshMessages(messageIdsRef.current);
      return;
    }

    const result = await refreshConversationAction({
      conversationId: chat.conversationId,
    }).catch(() => null);

    if (result?.status !== "sent") {
      return;
    }

    if (result.messages) {
      for (const message of result.messages) {
        dispatchChatEvent({ type: "mergeRemoteMessage", message });
      }
    }

    if (result.readStates) {
      for (const readState of result.readStates) {
        dispatchChatEvent({
          type: "mergeReadState",
          conversationId: chat.conversationId,
          readState,
        });
      }
      onReadStatesRefreshed?.(result.readStates);
    }
  }, [
    applyGapBackfill,
    backfillMessagesAction,
    chat.conversationId,
    dispatchChatEvent,
    onReadStatesRefreshed,
    refreshConversationAction,
    refreshMessages,
  ]);

  return {
    messages,
    setMessages,
    refreshMessages,
    refreshConversation,
    loadOlderMessages,
    applyGapBackfill,
    hasMoreOlder,
    isLoadingOlder,
    hasLoadError,
  };
}
