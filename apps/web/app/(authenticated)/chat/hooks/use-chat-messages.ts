import type { ClientChatData, ClientChatMessage } from "@/lib/services";
import { mergeChatMessage } from "../chat-state";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type LocalStatus = "pending" | "sent" | "failed";

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
  const initialMessages = useMemo(
    () => chat.messages.map(toLocalMessage),
    [chat.messages]
  );
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const messageIdsRef = useRef<string[]>([]);

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
        setMessages((current) =>
          result.messages!.reduce(
            (next, message) => mergeMessage(next, message),
            current
          )
        );
      }
    },
    [refreshMessagesAction]
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
      setMessages((current) =>
        result.messages!.reduce((next, message) => mergeMessage(next, message), current)
      );
    }

    if (result.readStates) {
      onReadStatesRefreshed?.(result.readStates);
    }
  }, [
    chat.conversationId,
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
