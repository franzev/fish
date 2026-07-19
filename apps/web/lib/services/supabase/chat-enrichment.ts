import type { AppSupabaseClient } from "./types";
import type { MessageResponseRow } from "./chat-mapping";

export interface ReactionRow {
  message_id: string;
  emoji: string;
  user_id: string;
}

export function aggregateReactions(
  rows: ReactionRow[],
  currentUserId: string
): Map<string, NonNullable<MessageResponseRow["reactions"]>> {
  const grouped = new Map<string, Map<string, { emoji: string; count: number; by_me: boolean }>>();
  for (const row of rows) {
    const reactions = grouped.get(row.message_id) ?? new Map();
    const current = reactions.get(row.emoji) ?? { emoji: row.emoji, count: 0, by_me: false };
    reactions.set(row.emoji, {
      emoji: row.emoji,
      count: current.count + 1,
      by_me: current.by_me || row.user_id === currentUserId,
    });
    grouped.set(row.message_id, reactions);
  }
  return new Map(
    Array.from(grouped.entries()).map(([messageId, reactions]) => [
      messageId,
      Array.from(reactions.values()),
    ])
  );
}

export interface AttachmentIndexRow {
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
}

export function indexAttachments(
  rows: AttachmentIndexRow[],
  signedUrlByPath: ReadonlyMap<string, string>
): Map<string, NonNullable<MessageResponseRow["images"]>> {
  const byMessage = new Map<string, NonNullable<MessageResponseRow["images"]>>();
  for (const row of rows) {
    const images = byMessage.get(row.message_id) ?? [];
    images.push({
      id: row.id,
      status: "ready",
      kind: row.kind,
      original_name: row.original_name,
      stored_mime_type: row.stored_mime_type ?? "application/octet-stream",
      stored_byte_size: row.stored_byte_size ?? 0,
      width: row.width ?? null,
      height: row.height ?? null,
      thumbnail_path: row.thumbnail_path ?? null,
      display_path: row.display_path ?? "",
      thumbnail_url: row.thumbnail_path ? signedUrlByPath.get(row.thumbnail_path) : undefined,
      display_url: row.display_path ? signedUrlByPath.get(row.display_path) : undefined,
    });
    byMessage.set(row.message_id, images);
  }
  return byMessage;
}

export async function fetchReactionsFor(
  client: AppSupabaseClient,
  messageIds: string[],
  currentUserId: string,
  conversationId?: string
) {
  const rows: ReactionRow[] = [];
  for (let batchStart = 0; batchStart < messageIds.length; batchStart += 25) {
    const batch = messageIds.slice(batchStart, batchStart + 25);
    for (let from = 0; ; from += 1000) {
      const query = client
        .from("message_reactions")
        .select("message_id, emoji, user_id")
        .in("message_id", batch)
        .is("removed_at", null);
      if (conversationId) {
        query.eq("conversation_id", conversationId);
      }
      const { data, error } = await query.range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
  }
  return aggregateReactions(rows, currentUserId);
}

export async function fetchAttachmentUrls(
  client: AppSupabaseClient,
  rows: AttachmentIndexRow[]
): Promise<Map<string, string>> {
  const paths = rows.flatMap((row) =>
    [row.thumbnail_path, row.display_path].filter((path): path is string => Boolean(path))
  );
  if (paths.length === 0) return new Map();
  const { data, error } = await client.storage.from("chat-images").createSignedUrls(paths, 15 * 60);
  if (error) throw error;
  return new Map(
    (data ?? []).flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])
  );
}
