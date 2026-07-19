import type { ChatMessageState, ChatReadState } from "@fish/core/chat-state";
import { useMemo } from "react";
import { createChatHydrationKey } from "@/features/chat/model/chat-state";

export function useHydratedConversation<TMessage extends ChatMessageState>(
  messages: TMessage[],
  readStates: ChatReadState[]
) {
  return useMemo(() => ({
    messages,
    readStates,
    hydrationKey: createChatHydrationKey(messages, readStates),
  }), [messages, readStates]);
}
