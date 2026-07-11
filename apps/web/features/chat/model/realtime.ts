import type {
  ConversationRecordingController,
  ConversationTypingController,
  PresenceSessionController,
} from "@/lib/services";
import { getChatRealtimeService } from "@/lib/services/runtime/browser";

export type ConversationTypingSubscription = ConversationTypingController;
export type ConversationVoiceRecordingSubscription = ConversationRecordingController;
export type { PresenceSessionController };

type Realtime = ReturnType<typeof getChatRealtimeService>;
export const subscribeToConversationMessages: Realtime["subscribeToMessages"] = (...args) => getChatRealtimeService().subscribeToMessages(...args);
export const subscribeToConversationReadStates: Realtime["subscribeToReadStates"] = (...args) => getChatRealtimeService().subscribeToReadStates(...args);
export const subscribeToConversationReactionChanges: Realtime["subscribeToReactionChanges"] = (...args) => getChatRealtimeService().subscribeToReactionChanges(...args);
export const subscribeToParticipantPresence: Realtime["subscribeToParticipantPresence"] = (...args) => getChatRealtimeService().subscribeToParticipantPresence(...args);
export const subscribeToConversationTyping: Realtime["subscribeToTyping"] = (...args) => getChatRealtimeService().subscribeToTyping(...args);
export const subscribeToConversationVoiceRecording: Realtime["subscribeToRecording"] = (...args) => getChatRealtimeService().subscribeToRecording(...args);
export const startPresenceSession: Realtime["startPresenceSession"] = (...args) => getChatRealtimeService().startPresenceSession(...args);
