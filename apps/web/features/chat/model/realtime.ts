import type {
  ConversationRecordingController,
  ConversationTypingController,
  ChatRealtimeService,
  PresenceSessionController,
} from "@/lib/services";
import { getChatRealtimeService } from "@/lib/services/runtime/browser";

export type ConversationTypingSubscription = ConversationTypingController;
export type ConversationVoiceRecordingSubscription = ConversationRecordingController;
export type { PresenceSessionController };

export function createChatRealtimeBindings(realtime: ChatRealtimeService) {
  return {
    subscribeToConversationMessages: realtime.subscribeToMessages.bind(realtime),
    subscribeToConversationReadStates: realtime.subscribeToReadStates.bind(realtime),
    subscribeToConversationReactionChanges:
      realtime.subscribeToReactionChanges.bind(realtime),
    subscribeToParticipantPresence:
      realtime.subscribeToParticipantPresence.bind(realtime),
    subscribeToConversationTyping: realtime.subscribeToTyping.bind(realtime),
    subscribeToConversationVoiceRecording:
      realtime.subscribeToRecording.bind(realtime),
    startPresenceSession: realtime.startPresenceSession.bind(realtime),
  };
}

function runtimeBindings() {
  return createChatRealtimeBindings(getChatRealtimeService());
}

type Realtime = ChatRealtimeService;
export const subscribeToConversationMessages: Realtime["subscribeToMessages"] =
  (...args) => runtimeBindings().subscribeToConversationMessages(...args);
export const subscribeToConversationReadStates: Realtime["subscribeToReadStates"] =
  (...args) => runtimeBindings().subscribeToConversationReadStates(...args);
export const subscribeToConversationReactionChanges: Realtime["subscribeToReactionChanges"] =
  (...args) => runtimeBindings().subscribeToConversationReactionChanges(...args);
export const subscribeToParticipantPresence: Realtime["subscribeToParticipantPresence"] =
  (...args) => runtimeBindings().subscribeToParticipantPresence(...args);
export const subscribeToConversationTyping: Realtime["subscribeToTyping"] =
  (...args) => runtimeBindings().subscribeToConversationTyping(...args);
export const subscribeToConversationVoiceRecording: Realtime["subscribeToRecording"] =
  (...args) => runtimeBindings().subscribeToConversationVoiceRecording(...args);
export const startPresenceSession: Realtime["startPresenceSession"] = (...args) =>
  runtimeBindings().startPresenceSession(...args);
