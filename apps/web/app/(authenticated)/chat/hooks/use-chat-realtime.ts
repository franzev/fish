import type { ClientChatData, ClientChatReadState } from "@/lib/services";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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

// Each of the messages/reads/reactions channels below fires its own initial
// post-mount SUBSCRIBED — track first-subscribe PER CHANNEL so all three
// initial subscribes are skipped (SSR data is already current) and only a
// channel's genuine re-subscribe after a drop is eligible to backfill
// (review HIGH 10-03).
type ReconnectChannelKey = "messages" | "reads" | "reactions";

interface UseChatRealtimeOptions {
  chat: ClientChatData;
  setMessages: Dispatch<SetStateAction<LocalMessage[]>>;
  mergeReadState: (readState: ClientChatReadState) => void;
  refreshMessages: (messageIds: string[]) => Promise<void>;
  refreshConversation: () => Promise<void>;
  /**
   * Bounded, coalesced reconnect backfill (Plan 10-02/10-03). Preferred over
   * refreshConversation on every channel's reconnect when wired;
   * refreshConversation stays as the deep fallback until every caller
   * injects this (review Suggestion 10-03).
   */
  applyGapBackfill?: () => Promise<void>;
}

export function useChatRealtime({
  chat,
  setMessages,
  mergeReadState,
  refreshMessages,
  refreshConversation,
  applyGapBackfill,
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
  // Per-channel first-subscribe tracker + one shared in-flight lock across
  // all three channels' onReconnected, so a near-simultaneous reconnect
  // triggers exactly one bounded backfill instead of three full refetches
  // (CLOAD-06, review HIGH 10-03).
  const seenFirstSubscribeRef = useRef<Set<ReconnectChannelKey>>(new Set());
  const backfillInFlightRef = useRef<Promise<void> | null>(null);

  const handleReconnected = useCallback(
    (channelKey: ReconnectChannelKey) => {
      if (!seenFirstSubscribeRef.current.has(channelKey)) {
        seenFirstSubscribeRef.current.add(channelKey);
        return;
      }

      if (backfillInFlightRef.current) {
        return;
      }

      const backfill = applyGapBackfill ?? refreshConversation;
      backfillInFlightRef.current = backfill().finally(() => {
        backfillInFlightRef.current = null;
      });
    },
    [applyGapBackfill, refreshConversation]
  );

  useEffect(() => {
    setRealtimeStatus(chat.conversationId, "connecting");
    return subscribeToConversationMessages(
      chat.conversationId,
      (message) => {
        dispatchChatEvent({ type: "mergeRemoteMessage", message });
      },
      () => {
        setRealtimeStatus(chat.conversationId, "connected");
        handleReconnected("messages");
      },
      () => {
        setRealtimeStatus(chat.conversationId, "disconnected");
      }
    );
  }, [
    chat.conversationId,
    dispatchChatEvent,
    handleReconnected,
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
        handleReconnected("reads");
      }
    );
  }, [chat.conversationId, dispatchChatEvent, handleReconnected, mergeReadState]);

  useEffect(() => {
    return subscribeToConversationReactionChanges(
      chat.conversationId,
      (messageId) => {
        void refreshMessages([messageId]);
      },
      () => {
        handleReconnected("reactions");
      }
    );
  }, [chat.conversationId, handleReconnected, refreshMessages]);

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
