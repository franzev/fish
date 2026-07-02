import type { UserRole } from "./roles";

export type ConversationId = string;
export type MessageId = string;
export type UserId = string;

export interface ChatParticipant {
  id: UserId;
  role: UserRole;
  displayName: string;
}

export interface ChatConversation {
  id: ConversationId;
  clientId: UserId;
  coachId: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: MessageId;
  conversationId: ConversationId;
  senderId: UserId;
  senderRole: UserRole;
  body: string;
  createdAt: string;
}

export interface SendMessageCommand {
  conversationId: ConversationId;
  body: string;
  clientRequestId?: string;
}

export interface SendMessageResult {
  message: ChatMessage;
}

export const chatLimits = {
  messageBodyMaxLength: 4000,
} as const;
