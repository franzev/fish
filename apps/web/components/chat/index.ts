/** The chat design-system kit — barrel entry point.
 *  `import { ChatContainer, Bubble, ConversationList } from "@/components/chat"` */
export * from "./attachments";
export * from "./avatar";
export * from "./bubble";
export * from "./chat-container";
export * from "./chat-header";
export * from "./chat-input";
export * from "./composer/composer";
export * from "./conversation-list";
export * from "./emoji-picker";
export * from "./empty-state";
export * from "./link-preview";
export * from "./message";
export * from "./message-actions";
export * from "./message-list";
export * from "./message-meta";
export { MessageStatus } from "./message-status";
export * from "./notification-badge";
export * from "./presence-indicator";
export * from "./quoted-message";
export * from "./reactions";
export * from "./search-filters";
export * from "./skeleton";
export type {
  Attachment,
  ChatMessageView,
  ChatParticipantView,
  MessageStatus as MessageStatusValue,
  Reaction,
} from "./types";
export * from "./typing-indicator";
export * from "./unread-divider";
export * from "./voice-player";
