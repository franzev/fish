import type { ClientChatData, ClientChatReadState } from "@/lib/services";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  type ConversationTypingSubscription,
  type ConversationVoiceRecordingSubscription,
  subscribeToConversationMessages,
  subscribeToConversationReactionChanges,
  subscribeToConversationReadStates,
  subscribeToConversationTyping,
  subscribeToConversationVoiceRecording,
} from "../realtime";
import type { LocalMessage } from "./use-chat-messages";
import { useChatStore } from "../store/chat-store";

interface UseChatRealtimeOptions {
  chat: ClientChatData;
  setMessages: Dispatch<SetStateAction<LocalMessage[]>>;
  mergeReadState: (readState: ClientChatReadState) => void;
  refreshMessages: (messageIds: string[]) => Promise<void>;
  refreshConversation: () => Promise<void>;
}

export function useChatRealtime({
  chat,
  setMessages,
  mergeReadState,
  refreshMessages,
  refreshConversation,
}: UseChatRealtimeOptions) {
  const [participantTyping, setParticipantTyping] = useState(false);
  const [participantRecording, setParticipantRecording] = useState(false);
  const [localRecording, setLocalRecording] = useState(false);
  const dispatchChatEvent = useChatStore((state) => state.dispatchChatEvent);
  const setRealtimeStatus = useChatStore((state) => state.setRealtimeStatus);
  const typingSubscriptionRef = useRef<ConversationTypingSubscription | null>(null);
  const voiceSubscriptionRef =
    useRef<ConversationVoiceRecordingSubscription | null>(null);
  const localTypingRef = useRef(false);
  const localTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participantTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participantRecordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRealtimeStatus(chat.conversationId, "connecting");
    return subscribeToConversationMessages(
      chat.conversationId,
      (message) => {
        dispatchChatEvent({ type: "mergeRemoteMessage", message });
      },
      () => {
        setRealtimeStatus(chat.conversationId, "connected");
        void refreshConversation();
      }
    );
  }, [
    chat.conversationId,
    dispatchChatEvent,
    refreshConversation,
    setMessages,
    setRealtimeStatus,
  ]);

  useEffect(() => {
    return subscribeToConversationReadStates(
      chat.conversationId,
      (readState) => {
        dispatchChatEvent({
          type: "mergeReadState",
          conversationId: chat.conversationId,
          readState,
        });
        mergeReadState(readState);
      },
      () => {
        void refreshConversation();
      }
    );
  }, [chat.conversationId, dispatchChatEvent, mergeReadState, refreshConversation]);

  useEffect(() => {
    return subscribeToConversationReactionChanges(
      chat.conversationId,
      (messageId) => {
        void refreshMessages([messageId]);
      },
      () => {
        void refreshConversation();
      }
    );
  }, [chat.conversationId, refreshConversation, refreshMessages]);

  useEffect(() => {
    const subscription = subscribeToConversationTyping(
      chat.conversationId,
      chat.currentUserId,
      (typing) => {
        setParticipantTyping(typing);

        if (participantTypingTimeoutRef.current) {
          clearTimeout(participantTypingTimeoutRef.current);
        }

        if (typing) {
          participantTypingTimeoutRef.current = setTimeout(() => {
            setParticipantTyping(false);
          }, 4000);
        }
      }
    );

    typingSubscriptionRef.current = subscription;

    return () => {
      typingSubscriptionRef.current = null;
      subscription.unsubscribe();

      if (localTypingTimeoutRef.current) {
        clearTimeout(localTypingTimeoutRef.current);
      }

      if (participantTypingTimeoutRef.current) {
        clearTimeout(participantTypingTimeoutRef.current);
      }
    };
  }, [chat.conversationId, chat.currentUserId]);

  useEffect(() => {
    const subscription = subscribeToConversationVoiceRecording(
      chat.conversationId,
      chat.currentUserId,
      (recording) => {
        setParticipantRecording(recording);

        if (participantRecordingTimeoutRef.current) {
          clearTimeout(participantRecordingTimeoutRef.current);
        }

        if (recording) {
          participantRecordingTimeoutRef.current = setTimeout(() => {
            setParticipantRecording(false);
          }, 5000);
        }
      }
    );

    voiceSubscriptionRef.current = subscription;

    return () => {
      voiceSubscriptionRef.current = null;
      subscription.unsubscribe();

      if (participantRecordingTimeoutRef.current) {
        clearTimeout(participantRecordingTimeoutRef.current);
      }
    };
  }, [chat.conversationId, chat.currentUserId]);

  function sendLocalTyping(typing: boolean) {
    if (localTypingRef.current === typing) {
      return;
    }

    localTypingRef.current = typing;
    typingSubscriptionRef.current?.sendTyping(typing);
  }

  function stopLocalTyping() {
    if (localTypingTimeoutRef.current) {
      clearTimeout(localTypingTimeoutRef.current);
      localTypingTimeoutRef.current = null;
    }

    sendLocalTyping(false);
  }

  function setLocalVoiceRecording(recording: boolean) {
    setLocalRecording(recording);
    voiceSubscriptionRef.current?.sendRecording(recording);
  }

  function scheduleLocalTypingStop() {
    if (localTypingTimeoutRef.current) {
      clearTimeout(localTypingTimeoutRef.current);
    }

    localTypingTimeoutRef.current = setTimeout(() => {
      sendLocalTyping(false);
      localTypingTimeoutRef.current = null;
    }, 3000);
  }

  return {
    participantTyping,
    participantRecording,
    localRecording,
    sendLocalTyping,
    stopLocalTyping,
    scheduleLocalTypingStop,
    setLocalVoiceRecording,
  };
}
