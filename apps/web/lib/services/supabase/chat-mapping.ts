import type {
  ClientChatGif,
  ClientChatMessage,
  ClientChatReadState,
} from "../contracts";

export const sendNotice =
  "That did not send yet. Keep this open and try again.";
export const saveNotice =
  "That did not save yet. Keep this open and try again.";
export const reactionPageSize = 1000;
export const chatOlderPageSize = 40;

/** Persisted sticker references are deliberately more permissive than send
 * commands. An older open client may receive a newly deployed catalog id; keep
 * it so the UI can render an unavailable-sticker fallback instead of a blank
 * message. */
export function readChatStickerId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const stickerId = value.trim();
  return stickerId || undefined;
}

export interface MessageResponseRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "client" | "coach";
  sender_display_name?: string | null;
  senderDisplayName?: string | null;
  body: string;
  client_request_id: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_message_id?: string | null;
  pinned_at?: string | null;
  pinned_by?: string | null;
  sticker_id?: string | null;
  reactions?: Array<{
    emoji: string;
    count: number;
    by_me?: boolean;
    byMe?: boolean;
  }>;
  images?: ImageResponseRow[];
  gif?: GifResponseRow | null;
}

export interface GifResponseRow {
  message_id: string;
  provider: ClientChatGif["provider"];
  provider_content_id: string;
  title: string;
  description: string;
  source_url: string;
  poster_url: string;
  preview_url: string;
  media_url: string;
  width: number;
  height: number;
}

export interface ImageResponseRow {
  id: string;
  status: "ready";
  kind: "image" | "file";
  original_name: string;
  stored_mime_type: string;
  stored_byte_size: number;
  width: number | null;
  height: number | null;
  thumbnail_path: string | null;
  display_path: string;
  thumbnail_url?: string;
  display_url?: string;
}

export interface ReadStateResponseRow {
  user_id: string;
  last_delivered_message_id: string | null;
  delivered_at: string | null;
  last_read_message_id: string | null;
  read_at: string | null;
}

export function toClientChatMessage(
  row: MessageResponseRow
): ClientChatMessage {
  const stickerId = readChatStickerId(row.sticker_id);

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    senderDisplayName:
      row.senderDisplayName ?? row.sender_display_name ?? null,
    body: row.body,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at ?? null,
    replyToMessageId: row.reply_to_message_id ?? null,
    pinnedAt: row.pinned_at ?? null,
    pinnedBy: row.pinned_by ?? null,
    reactions: (row.reactions ?? []).map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
      byMe: reaction.byMe ?? reaction.by_me ?? false,
    })),
    gif: row.gif
      ? {
          provider: row.gif.provider,
          providerId: row.gif.provider_content_id,
          title: row.gif.title,
          description: row.gif.description,
          sourceUrl: row.gif.source_url,
          posterUrl: row.gif.poster_url,
          previewUrl: row.gif.preview_url,
          mediaUrl: row.gif.media_url,
          width: row.gif.width,
          height: row.gif.height,
        }
      : undefined,
    ...(stickerId ? { stickerId } : {}),
    images: (row.images ?? []).map((image) => ({
      id: image.id,
      status: "ready",
      kind: image.kind,
      originalName: image.original_name,
      mimeType: image.stored_mime_type,
      byteSize: image.stored_byte_size,
      width: image.width ?? undefined,
      height: image.height ?? undefined,
      thumbnailPath: image.thumbnail_path ?? undefined,
      displayPath: image.display_path,
      thumbnailUrl: image.thumbnail_url,
      displayUrl: image.display_url,
    })),
  };
}

export function toClientReadState(
  row: ReadStateResponseRow
): ClientChatReadState {
  return {
    userId: row.user_id,
    lastDeliveredMessageId: row.last_delivered_message_id,
    deliveredAt: row.delivered_at,
    lastReadMessageId: row.last_read_message_id,
    readAt: row.read_at,
  };
}

export function mapChatErrorNotice(
  error: { message?: string } | null | undefined,
  fallback = sendNotice
): string {
  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("conversation not found")) {
    return "That conversation is not available.";
  }
  if (message.includes("conflicts")) {
    return "That send is already in progress. Try once more.";
  }
  if (
    message.includes("reply target") ||
    message.includes("message not found")
  ) {
    return "That message is no longer available.";
  }
  if (message.includes("reaction")) {
    return "That reaction is not available.";
  }
  if (message.includes("too long")) {
    return "This message is a little long. Try sending it in two parts.";
  }
  if (message.includes("required")) {
    return "Add a message before sending.";
  }
  return fallback;
}
