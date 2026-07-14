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
  gif?: ChatGif;
  /** Stable catalog reference returned by persisted messages. Readers preserve
   * unknown ids so older clients can render a calm fallback during rollouts. */
  stickerId?: string;
  images?: ChatImage[];
  createdAt: string;
}

export type ChatGifProvider = "klipy" | "giphy";

export const chatStickerIds = [
  "aquatic-thank-you-octopus",
  "aquatic-good-night-whale",
  "aquatic-great-job-sea-star",
  "aquatic-hello-otter",
  "aquatic-awesome-dolphin",
  "aquatic-see-you-soon-turtle",
  "aquatic-youre-welcome-seal",
  "aquatic-goodbye-squid",
  "aquatic-good-morning-seahorse",
  "aquatic-congratulations-jellyfish",
  "aquatic-sorry-penguin",
  "aquatic-please-shrimp",
  "aquatic-yes-crab",
  "aquatic-no-lobster",
  "aquatic-okay-manta-ray",
  "aquatic-good-luck-goldfish",
  "aquatic-happy-birthday-narwhal",
  "aquatic-i-miss-you-manatee",
  "aquatic-love-you-angelfish",
  "aquatic-lol-clownfish",
  "aquatic-omg-pufferfish",
  "aquatic-cheers-walrus",
  "aquatic-welcome-back-sea-lion",
  "aquatic-nice-nudibranch",
  "aquatic-you-got-this-shark",
  "aquatic-on-it-tuna",
  "aquatic-sounds-good-blue-tang",
  "aquatic-be-right-back-sailfish",
  "aquatic-keep-going-salmon",
  "aquatic-thinking-cuttlefish",
  "aquatic-take-your-time-koi",
  "aquatic-im-here-orca",
] as const;

export type ChatStickerId = (typeof chatStickerIds)[number];

export function isChatStickerId(value: unknown): value is ChatStickerId {
  return typeof value === "string"
    && (chatStickerIds as readonly string[]).includes(value);
}

/** Provider-hosted animated media attached to one chat message. The provider
 *  identifier and source URL preserve attribution and moderation context;
 *  FISH never copies the media into private chat storage. */
export interface ChatGif {
  provider: ChatGifProvider;
  providerId: string;
  title: string;
  description: string;
  sourceUrl: string;
  posterUrl: string;
  previewUrl: string;
  mediaUrl: string;
  width: number;
  height: number;
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
  gif?: ChatGif;
  stickerId?: ChatStickerId;
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
