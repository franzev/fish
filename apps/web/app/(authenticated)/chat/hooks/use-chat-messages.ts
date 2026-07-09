import type { ClientChatData, ClientChatMessage } from "@/lib/services";
import type { ChatMessageState } from "@fish/core/chat-state";
import { mergeChatMessage } from "../chat-state";
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
} from "../store/chat-store";
import {
  selectHydrationKeyForConversation,
  selectMessagesForConversation,
  selectReadStatesForConversation,
} from "../store/chat-selectors";

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
  onReadStatesRefreshed?: (readStates: NonNullable<ClientChatData["readStates"]>) => void;
}

export function useChatMessages({
  chat,
  refreshMessagesAction,
  refreshConversationAction,
  onReadStatesRefreshed,
}: UseChatMessagesOptions) {
  const storeMessages = useChatStore((state) =>
    selectMessagesForConversation(state, chat.conversationId)
  ) as LocalMessage[];
  const storedHydrationKey = useChatStore((state) =>
    selectHydrationKeyForConversation(state, chat.conversationId)
  );
  const hydrateConversation = useChatStore((state) => state.hydrateConversation);
  const dispatchChatEvent = useChatStore((state) => state.dispatchChatEvent);
  const messageIdsRef = useRef<string[]>([]);
  const refreshingMessageIdsRef = useRef<Set<string>>(new Set());
  const lastMessageRefreshAtRef = useRef<Map<string, number>>(new Map());
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
    hydrateConversation(
      chat.conversationId,
      initialMessages,
      initialReadStates,
      hydrationKey
    );
  }, [
    chat.conversationId,
    hydrateConversation,
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

  const refreshConversation = useCallback(async () => {
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
  };
}
