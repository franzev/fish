import type {
  ClientChatData,
  ClientChatReadState,
} from "@/lib/services";
import {
  countUnreadMessages,
  mergeReadState as mergeChatReadState,
} from "../chat-state";
import type { LocalMessage } from "./use-chat-messages";
import { useCallback, useEffect, useMemo } from "react";
import { chatStore, useChatStore } from "../store/chat-store";
import { selectReadStatesForConversation } from "../store/chat-selectors";

export interface MarkReadStateActionState {
  status: "sent" | "notice";
  values: unknown;
  notice?: string;
  readState?: ClientChatReadState;
}

interface UseChatReadStateOptions {
  chat: ClientChatData;
  messages: LocalMessage[];
  markReadStateAction?: (input: unknown) => Promise<MarkReadStateActionState>;
}

export function useChatReadState({
  chat,
  messages,
  markReadStateAction,
}: UseChatReadStateOptions) {
  const readStates = useChatStore((state) =>
    selectReadStatesForConversation(state, chat.conversationId)
  ) as ClientChatReadState[];
  const mergeReadStateAction = useChatStore((state) => state.mergeReadState);

  const setReadStates = useCallback(
    (nextReadStates: ClientChatReadState[]) => {
      const messagesSnapshot =
        chatStore.getState().conversations[chat.conversationId]?.messages ?? [];
      chatStore
        .getState()
        .hydrateConversation(chat.conversationId, messagesSnapshot, nextReadStates);
    },
    [chat.conversationId]
  );

  const mergeReadState = useCallback((readState: ClientChatReadState) => {
    mergeReadStateAction(chat.conversationId, readState);
  }, [chat.conversationId, mergeReadStateAction]);

  const mergeReadStates = useCallback((incoming: ClientChatReadState[]) => {
    const current = selectReadStatesForConversation(
      chatStore.getState(),
      chat.conversationId
    ) as ClientChatReadState[];
    setReadStates(
      incoming.reduce((next, readState) => mergeChatReadState(next, readState), current)
    );
  }, [chat.conversationId, setReadStates]);

  const currentUserReadState = useMemo(
    () => readStates.find((state) => state.userId === chat.currentUserId),
    [chat.currentUserId, readStates]
  );
  const participantReadState = useMemo(
    () => readStates.find((state) => state.userId === chat.participant.id),
    [chat.participant.id, readStates]
  );
  const unreadCount = useMemo(
    () => countUnreadMessages(messages, chat.currentUserId, currentUserReadState),
    [chat.currentUserId, currentUserReadState, messages]
  );

  useEffect(() => {
    if (!markReadStateAction) {
      return;
    }

    const latestParticipantMessage = [...messages]
      .reverse()
      .find((message) => message.senderId !== chat.currentUserId);

    if (!latestParticipantMessage) {
      return;
    }

    if (
      currentUserReadState?.lastReadMessageId === latestParticipantMessage.id &&
      currentUserReadState?.lastDeliveredMessageId === latestParticipantMessage.id
    ) {
      return;
    }

    void markReadStateAction({
      conversationId: chat.conversationId,
      lastDeliveredMessageId: latestParticipantMessage.id,
      lastReadMessageId: latestParticipantMessage.id,
    })
      .then((result) => {
        if (result.status === "sent" && result.readState) {
          mergeReadState(result.readState);
        }
      })
      .catch(() => undefined);
  }, [
    chat.conversationId,
    chat.currentUserId,
    currentUserReadState?.lastDeliveredMessageId,
    currentUserReadState?.lastReadMessageId,
    markReadStateAction,
    mergeReadState,
    messages,
  ]);

  return {
    readStates,
    setReadStates,
    mergeReadState,
    mergeReadStates,
    currentUserReadState,
    participantReadState,
    unreadCount,
  };
}
