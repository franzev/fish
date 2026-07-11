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
import { chatStore, useChatStore } from "../store/chat-store";
import { selectMessagesForConversation } from "../store/chat-selectors";
import type { ClientChatMessage } from "@/lib/services";

// Supabase postgres_changes payloads carry only the raw messages row — no
// joined profile — so a live-received message arrives with senderDisplayName
// undefined. Every other path (SSR, refresh, backfill) enriches names from the
// `profiles` table; the realtime path must do the same or a community message
// renders the "Member" fallback (chat-client getMessageAuthorName). Resolve
// from names we already hold (own user, the direct participant, or an earlier
// loaded message from the same sender) without a round-trip; return null only
// when the sender is genuinely unknown so the caller can fall back to a
// targeted refetch.
function resolveRealtimeSenderName(
  message: ClientChatMessage,
  conversationId: string,
  currentUserId: string,
  currentUserDisplayName: string,
  participant: { id: string; displayName: string }
): string | null {
  if (message.senderDisplayName) {
    return message.senderDisplayName;
  }
  if (message.senderId === currentUserId) {
    return currentUserDisplayName;
  }
  if (message.senderId === participant.id) {
    return participant.displayName;
  }
  const known = selectMessagesForConversation(
    chatStore.getState(),
    conversationId
  ).find(
    (candidate) =>
      candidate.senderId === message.senderId && candidate.senderDisplayName
  );
  return known?.senderDisplayName ?? null;
}

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

  // A mounted client can switch conversations without unmounting. Every
  // participant/local realtime transient (typing, recording, the local "am
  // I typing" flag) is scoped to the conversation it was observed in --
  // carrying A's activity into B would show a false participant indicator
  // (WR-06). Reset the STATE values via the render-time "adjusting state
  // when a prop changes" pattern (the same idiom ChatClient already uses for
  // previousRealtimeStatus) so no setState-in-effect lint fires.
  const [previousConversationId, setPreviousConversationId] = useState(
    chat.conversationId
  );
  if (chat.conversationId !== previousConversationId) {
    setPreviousConversationId(chat.conversationId);
    setParticipantTyping(false);
    setParticipantRecording(false);
    setLocalRecording(false);
  }

  // A new conversation's first subscribes must read as first connects, not
  // reconnects, and its backfill lock must not carry over from whatever
  // conversation was open before — reset both per conversation id (WR-05).
  // localTypingRef and the three pending typing/recording timeout refs are
  // also conversation-scoped (WR-06): left uncleared, a delayed
  // setParticipantTyping(false)/setParticipantRecording(false) callback
  // scheduled by the previous conversation could fire after the new
  // conversation's own indicator was set, wiping real activity. Refs are
  // never read or written during render (react-hooks/refs) -- unlike the
  // state resets above, these live in this effect.
  useEffect(() => {
    seenFirstSubscribeRef.current = new Set();
    backfillInFlightRef.current = null;
    localTypingRef.current = false;

    if (localTypingTimeoutRef.current) {
      clearTimeout(localTypingTimeoutRef.current);
      localTypingTimeoutRef.current = null;
    }
    if (participantTypingTimeoutRef.current) {
      clearTimeout(participantTypingTimeoutRef.current);
      participantTypingTimeoutRef.current = null;
    }
    if (participantRecordingTimeoutRef.current) {
      clearTimeout(participantRecordingTimeoutRef.current);
      participantRecordingTimeoutRef.current = null;
    }
  }, [chat.conversationId]);

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
      const ownedBackfillPromise: Promise<void> = backfill().finally(() => {
        if (backfillInFlightRef.current === ownedBackfillPromise) {
          backfillInFlightRef.current = null;
        }
      });
      backfillInFlightRef.current = ownedBackfillPromise;
    },
    [applyGapBackfill, refreshConversation]
  );

  useEffect(() => {
    let active = true;
    setRealtimeStatus(chat.conversationId, "connecting");
    const unsubscribe = subscribeToConversationMessages(
      chat.conversationId,
      (message) => {
        if (!active) {
          return;
        }

        const senderDisplayName = resolveRealtimeSenderName(
          message,
          chat.conversationId,
          chat.currentUserId,
          chat.currentUserDisplayName,
          chat.participant
        );
        dispatchChatEvent({
          type: "mergeRemoteMessage",
          message: senderDisplayName ? { ...message, senderDisplayName } : message,
        });
        // Sender not among names we already hold (e.g. first message from a
        // community member with no earlier loaded message): pull the enriched
        // row through the same profiles-backed refresh path SSR/reactions use,
        // so the transient "Member" fallback self-corrects.
        if (!senderDisplayName) {
          void refreshMessages([message.id]);
        }
      },
      () => {
        if (!active) {
          return;
        }

        setRealtimeStatus(chat.conversationId, "connected");
        handleReconnected("messages");
      },
      () => {
        if (!active) {
          return;
        }

        setRealtimeStatus(chat.conversationId, "disconnected");
      }
    );

    // Only the message channel owns connected/disconnected/idle status
    // (reads/reactions never call setRealtimeStatus), so resetting to idle
    // here cannot falsely disconnect another surface. Unmounting or
    // switching conversations must return this conversation's status to
    // idle so the next mount starts from an ordinary first connect instead
    // of stale "connected" read as a reconnect (WR-05).
    return () => {
      active = false;
      unsubscribe();
      setRealtimeStatus(chat.conversationId, "idle");
    };
  }, [
    chat.conversationId,
    chat.currentUserId,
    chat.currentUserDisplayName,
    chat.participant,
    dispatchChatEvent,
    handleReconnected,
    refreshMessages,
    setMessages,
    setRealtimeStatus,
  ]);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToConversationReadStates(
      chat.conversationId,
      (readState) => {
        if (!active) {
          return;
        }

        // Single dispatch path: mergeReadState (the store action) already
        // routes through one dispatchChatEvent call. A second direct
        // dispatch here duplicated every read-state store transition (WR-06).
        mergeReadState(readState);
      },
      () => {
        if (!active) {
          return;
        }

        handleReconnected("reads");
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [chat.conversationId, handleReconnected, mergeReadState]);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToConversationReactionChanges(
      chat.conversationId,
      (messageId) => {
        if (!active) {
          return;
        }

        void refreshMessages([messageId]);
      },
      () => {
        if (!active) {
          return;
        }

        handleReconnected("reactions");
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
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
