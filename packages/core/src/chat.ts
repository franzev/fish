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
  images?: ChatImage[];
  createdAt: string;
}

export interface ChatImage {
  id: string;
  status: "ready";
  kind?: "image" | "file";
  originalName: string;
  mimeType?: string;
  byteSize?: number;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  displayPath: string;
  thumbnailUrl?: string;
  displayUrl?: string;
}

export interface SendMessageCommand {
  conversationId: ConversationId;
  body: string;
  clientRequestId?: string;
  attachmentIds?: string[];
}

export interface SendMessageResult {
  message: ChatMessage;
}

export const chatLimits = {
  messageBodyMaxLength: 4000,
  attachmentMaxCount: 5,
  attachmentSourceMaxBytes: 10 * 1024 * 1024,
  imageMaxCount: 5,
  imageSourceMaxBytes: 10 * 1024 * 1024,
  imageUploadMaxBytes: 5 * 1024 * 1024,
} as const;
