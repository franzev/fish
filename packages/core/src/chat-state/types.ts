import type { UserRole } from "../roles";

export type ChatConversationId = string;
export type ChatMessageId = string;
export type ChatUserId = string;
export type LocalMessageStatus = "pending" | "sending" | "sent" | "failed";
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
  /** Display name resolved at fetch time. Command/realtime payloads often
   *  omit it — merges must not let a null overwrite a known name. */
  senderDisplayName?: string | null;
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

/** Keyset pagination cursor: the oldest loaded message's ordering key. */
export interface ChatMessageCursor {
  createdAt: string;
  id: string;
}

export interface ChatPaginationState {
  oldestLoadedCursor: ChatMessageCursor | null;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  /** Set atomically with isLoadingOlder=false on olderPageLoadFailed so the
   *  observer guard in use-load-older-messages.ts never sees a commit where
   *  loading is false but the failure hasn't landed yet (the one-automatic-
   *  attempt gate; see .planning/debug/older-load-double-retry.md). */
  hasLoadError: boolean;
}

export interface ChatConversationState {
  conversationId: ChatConversationId;
  messages: ChatMessageState[];
  readStates: ChatReadState[];
  composer: ChatComposerState;
  realtime: {
    status: RealtimeConnectionState;
  };
  pagination: ChatPaginationState;
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
    }
  | {
      type: "hydrateWindow";
      conversationId: ChatConversationId;
      messages: ChatMessageState[];
      readStates: ChatReadState[];
      hasMoreOlder: boolean;
      oldestCursor: ChatMessageCursor | null;
    }
  | {
      type: "olderMessagesRequested";
      conversationId: ChatConversationId;
    }
  | {
      type: "olderPageLoaded";
      conversationId: ChatConversationId;
      messages: ChatMessageState[];
      hasMoreOlder: boolean;
      oldestCursor: ChatMessageCursor | null;
    }
  | {
      type: "olderPageLoadFailed";
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
