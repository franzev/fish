import type { AppSupabaseClient } from "./types";
import type { MessageResponseRow } from "./chat-mapping";

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
  messageIds: string[]
) {
  const byMessage = new Map<
    string,
    NonNullable<MessageResponseRow["reactions"]>
  >();
  for (let batchStart = 0; batchStart < messageIds.length; batchStart += 50) {
    const { data, error } = await client.rpc(
      "list_message_reaction_summaries",
      { p_message_ids: messageIds.slice(batchStart, batchStart + 50) }
    );
    if (error) throw error;
    for (const row of data ?? []) {
      const summaries = byMessage.get(row.message_id) ?? [];
      summaries.push({ emoji: row.emoji, count: row.count, by_me: row.by_me });
      byMessage.set(row.message_id, summaries);
    }
  }
  return byMessage;
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
