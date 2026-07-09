/** The chat design-system kit — barrel entry point.
 *  `import { Avatar, Composer, EmptyState } from "@/components/chat"` */
export * from "./avatar";
export * from "./bubble";
export * from "./composer/composer";
export * from "./emoji-picker";
export * from "./empty-state";
export * from "./message-body";
export * from "./message-meta";
export { MessageStatus } from "./message-status";
export * from "./quoted-message";
export * from "./reactions";
export * from "./search-filters";
export type { MessageStatus as MessageStatusValue, Reaction } from "./types";
export * from "./typing-indicator";
