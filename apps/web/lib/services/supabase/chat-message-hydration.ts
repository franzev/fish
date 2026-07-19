import type { ClientChatMessage } from "../contracts";
import {
  toClientChatMessage,
  type MessageResponseRow,
} from "./chat-mapping";
import { loadSenderDisplayNames } from "./chat-sender-profiles";
import { fetchReactionsFor, indexAttachments } from "./chat-enrichment";
import type { AppSupabaseClient } from "./types";

export async function hydrateClientChatMessages(
  client: AppSupabaseClient,
  messages: MessageResponseRow[]
): Promise<ClientChatMessage[]> {
  if (messages.length === 0) return [];

  const displayNames = await loadSenderDisplayNames(client, messages);

  const messageIds = messages.map((message) => message.id);
  const { data: attachments, error: attachmentsError } = await client
    .from("message_attachments")
    .select("id, message_id, kind, original_name, stored_mime_type, stored_byte_size, width, height, thumbnail_path, display_path, position, status")
    .in("message_id", messageIds)
    .eq("status", "ready")
    .order("position", { ascending: true });
  if (attachmentsError) {
    throw new Error("Message attachments are temporarily unavailable.");
  }

  const paths = (attachments ?? []).flatMap((attachment) =>
    [attachment.thumbnail_path, attachment.display_path].filter(
      (path): path is string => Boolean(path)
    )
  );
  const signed = paths.length > 0
    ? await client.storage.from("chat-images").createSignedUrls(paths, 15 * 60)
    : { data: [], error: null };
  const urls = new Map(
    (signed.data ?? []).flatMap((item) =>
      item.path && item.signedUrl
        ? [[item.path, item.signedUrl] as const]
        : []
    )
  );

  const imagesByMessage = indexAttachments(
    (attachments ?? []) as Array<{
      id: string;
      message_id: string;
      status: "ready";
      kind: "image" | "file";
      original_name: string;
      stored_mime_type: string | null;
      stored_byte_size: number | null;
      width: number | null;
      height: number | null;
      thumbnail_path: string | null;
      display_path: string | null;
    }>,
    urls
  );

  const reactionsByMessage = await fetchReactionsFor(client, messageIds);

  return messages.map((message) =>
    toClientChatMessage({
      ...message,
      sender_display_name:
        message.sender_display_name ?? displayNames.get(message.sender_id) ?? null,
      images: imagesByMessage.get(message.id) ?? message.images ?? [],
      reactions: reactionsByMessage.get(message.id) ?? [],
    })
  );
}
