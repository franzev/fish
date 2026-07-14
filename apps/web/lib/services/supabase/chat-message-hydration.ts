import type { ClientChatMessage } from "../contracts";
import {
  toClientChatMessage,
  type MessageResponseRow,
} from "./chat-mapping";
import { loadSenderDisplayNames } from "./chat-sender-profiles";
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
  const { data: attachments } = await client
    .from("message_attachments")
    .select("id, message_id, kind, original_name, stored_mime_type, stored_byte_size, width, height, thumbnail_path, display_path, position, status")
    .in("message_id", messageIds)
    .eq("status", "ready")
    .order("position", { ascending: true });

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

  const imagesByMessage = new Map<
    string,
    NonNullable<MessageResponseRow["images"]>
  >();
  for (const attachment of attachments ?? []) {
    if (
      !attachment.message_id ||
      !attachment.display_path ||
      !attachment.stored_mime_type ||
      !attachment.stored_byte_size
    ) {
      continue;
    }
    const images = imagesByMessage.get(attachment.message_id) ?? [];
    images.push({
      id: attachment.id,
      status: "ready",
      kind: attachment.kind as "image" | "file",
      original_name: attachment.original_name,
      stored_mime_type: attachment.stored_mime_type,
      stored_byte_size: attachment.stored_byte_size,
      width: attachment.width,
      height: attachment.height,
      thumbnail_path: attachment.thumbnail_path,
      display_path: attachment.display_path,
      thumbnail_url: attachment.thumbnail_path
        ? urls.get(attachment.thumbnail_path)
        : undefined,
      display_url: urls.get(attachment.display_path),
    });
    imagesByMessage.set(attachment.message_id, images);
  }

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
  const reactionsByMessage = new Map<
    string,
    Map<string, { emoji: string; count: number; by_me: boolean }>
  >();
  for (const reaction of reactionRows) {
    const messageReactions = reactionsByMessage.get(reaction.message_id) ?? new Map();
    const aggregate = messageReactions.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      by_me: false,
    };
    messageReactions.set(reaction.emoji, {
      ...aggregate,
      count: aggregate.count + 1,
      by_me: aggregate.by_me || reaction.user_id === currentUserId,
    });
    reactionsByMessage.set(reaction.message_id, messageReactions);
  }

  return messages.map((message) =>
    toClientChatMessage({
      ...message,
      sender_display_name:
        message.sender_display_name ?? displayNames.get(message.sender_id) ?? null,
      images: imagesByMessage.get(message.id) ?? message.images ?? [],
      reactions: Array.from(reactionsByMessage.get(message.id)?.values() ?? []),
    })
  );
}
