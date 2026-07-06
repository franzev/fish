import type { UserRole } from "../roles";

export type ChatConversationId = string;
export type ChatMessageId = string;
export type ChatUserId = string;
export type LocalMessageStatus = "sending" | "sent" | "failed";
export type OutgoingMessageStatus = "sent" | "delivered" | "read";
export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

export interface ChatReactionState {
  emoji: string;
  count: number;
  byMe: boolean;
}

export interface ChatMessageState {
  id: ChatMessageId;
  conversationId: ChatConversationId;
  senderId: ChatUserId;
  senderRole: UserRole;
  body: string;
  clientRequestId: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToMessageId?: ChatMessageId | null;
  reactions?: ChatReactionState[];
  localStatus?: LocalMessageStatus;
  failureReason?: string | null;
}

export interface ChatReadState {
  userId: ChatUserId;
  lastDeliveredMessageId: ChatMessageId | null;
  deliveredAt: string | null;
  lastReadMessageId: ChatMessageId | null;
  readAt: string | null;
}

export interface ChatComposerState {
  draft: string;
  replyTargetId: ChatMessageId | null;
  editTargetId: ChatMessageId | null;
}

export interface ChatConversationState {
  conversationId: ChatConversationId;
  messages: ChatMessageState[];
  readStates: ChatReadState[];
  composer: ChatComposerState;
  realtime: {
    status: RealtimeConnectionState;
  };
}

export interface ChatState {
  conversations: Record<ChatConversationId, ChatConversationState>;
}

export type ChatEvent =
  | {
      type: "hydrateConversation";
      conversationId: ChatConversationId;
      messages: ChatMessageState[];
      readStates: ChatReadState[];
    }
  | {
      type: "draftChanged";
      conversationId: ChatConversationId;
      draft: string;
    }
  | {
      type: "sendOptimisticMessage";
      message: ChatMessageState;
    }
  | {
      type: "confirmSentMessage";
      message: ChatMessageState;
      localRequestId?: string;
    }
  | {
      type: "markMessageFailed";
      conversationId: ChatConversationId;
      clientRequestId: string;
      reason?: string;
    }
  | {
      type: "mergeRemoteMessage";
      message: ChatMessageState;
      localRequestId?: string;
    }
  | {
      type: "mergeReadState";
      conversationId: ChatConversationId;
      readState: ChatReadState;
    }
  | {
      type: "setReplyTarget";
      conversationId: ChatConversationId;
      messageId: ChatMessageId | null;
    }
  | {
      type: "setEditTarget";
      conversationId: ChatConversationId;
      messageId: ChatMessageId | null;
    }
  | {
      type: "setRealtimeStatus";
      conversationId: ChatConversationId;
      status: RealtimeConnectionState;
    }
  | {
      type: "clearComposer";
      conversationId: ChatConversationId;
    };

export interface ChatResult {
  state: ChatState;
  event: ChatEvent;
}

export interface ReplyPreview {
  id: ChatMessageId;
  authorName: string;
  snippet: string;
}
