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
  /** Canonical ordered attachment collection. */
  attachments?: ChatAttachment[];
  /** @deprecated Compatibility alias used by the current web boundary. */
  images?: ChatAttachment[];
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

export interface ChatAttachment {
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

/** @deprecated Use ChatAttachment. */
export type ChatImage = ChatAttachment;

export type ChatAttachmentSourceMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/heic"
  | "image/heif"
  | "image/avif"
  | "application/pdf"
  | "text/plain"
  | "text/csv"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export type ChatAttachmentCommandErrorCode =
  | "invalid_request"
  | "not_authenticated"
  | "not_authorized"
  | "not_found"
  | "unsupported_type"
  | "too_large"
  | "invalid_hash"
  | "integrity_mismatch"
  | "invalid_file"
  | "unsafe_archive"
  | "encrypted_archive"
  | "macro_not_allowed"
  | "malware_detected"
  | "scan_unavailable"
  | "rate_limited"
  | "upload_conflict"
  | "upload_expired"
  | "missing_upload"
  | "processing"
  | "processing_failed"
  | "cancelled"
  | "delivery_unavailable"
  | "upload_unavailable";

export interface InitializeChatAttachmentUploadCommand {
  action: "initialize-upload";
  conversationId: ConversationId;
  clientUploadId: string;
  originalName: string;
  sourceMimeType: ChatAttachmentSourceMime;
  sourceByteSize: number;
  /** Normalized private staging representation. Web omits this and keeps its
   * WebP default; native ImageIO clients declare JPEG. */
  uploadMimeType?: "image/webp" | "image/jpeg";
  /** SHA-256 of the exact normalized image or document bytes being uploaded. */
  uploadSha256?: string;
}

export interface ChatAttachmentUploadAuthorization {
  attachmentId: string;
  bucket: "chat-images";
  objectPath: string;
  uploadToken: string;
  uploadMimeType: string;
  tusEndpoint: string;
  tusHeaders: Readonly<{ "x-signature": string }>;
  signedUploadUrl: string;
  expiresAt: string;
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
  documentSourceMaxBytes: 10 * 1024 * 1024,
  imageMaxCount: 5,
  imageSourceMaxBytes: 25 * 1024 * 1024,
  imageUploadMaxBytes: 5 * 1024 * 1024,
  imageMaxPixels: 25_000_000,
} as const;
