import type { ClientChatMessage } from "../contracts";
import {
  toClientChatMessage,
  type MessageResponseRow,
} from "./chat-mapping";
import { loadSenderDisplayNames } from "./chat-sender-profiles";
import { aggregateReactions, indexAttachments } from "./chat-enrichment";
import type { AppSupabaseClient } from "./types";

export async function hydrateClientChatMessages(
  client: AppSupabaseClient,
  messages: MessageResponseRow[]
): Promise<ClientChatMessage[]> {
  if (messages.length === 0) return [];

  const displayNames = await loadSenderDisplayNames(client, messages);

  const { data: userData } = await client.auth.getUser();
  const currentUserId = userData.user?.id ?? "";

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

  const reactionRows: Array<{ message_id: string; emoji: string; user_id: string }> = [];
  for (let batchStart = 0; batchStart < messageIds.length; batchStart += 25) {
    const batch = messageIds.slice(batchStart, batchStart + 25);
    for (let from = 0;; from += 1000) {
      const { data: reactions } = await client
        .from("message_reactions")
        .select("message_id, emoji, user_id")
        .in("message_id", batch)
        .is("removed_at", null)
        .range(from, from + 999);
      reactionRows.push(...(reactions ?? []));
      if ((reactions ?? []).length < 1000) break;
    }
  }
  const reactionsByMessage = aggregateReactions(reactionRows, currentUserId);

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
