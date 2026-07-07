import type { ClientChatData, ClientChatMessage } from "@/lib/services";
import type { ChatMessageState } from "@fish/core/chat-state";
import { mergeChatMessage } from "../chat-state";
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { chatStore, useChatStore } from "../store/chat-store";
import {
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
  const messages = useChatStore((state) =>
    selectMessagesForConversation(state, chat.conversationId)
  ) as LocalMessage[];
  const hydrateConversation = useChatStore((state) => state.hydrateConversation);
  const dispatchChatEvent = useChatStore((state) => state.dispatchChatEvent);
  const messageIdsRef = useRef<string[]>([]);

  useEffect(() => {
    hydrateConversation(
      chat.conversationId,
      chat.messages.map(toLocalMessage),
      chat.readStates ?? []
    );
  }, [chat.conversationId, chat.messages, chat.readStates, hydrateConversation]);

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

      const result = await refreshMessagesAction({
        messageIds: Array.from(new Set(messageIds)),
      }).catch(() => null);

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
