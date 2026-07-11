"use client";

import { createBrowserSupabaseClient } from "./browser";
import { getPublicEnv } from "../env";
import type {
  ChatImageService,
  ChatImageUploadAuthorization,
  ReadyChatImageUpload,
} from "../contracts";

async function invoke<T>(
  body: Record<string, unknown>,
  timeout = 15_000
): Promise<T> {
  const result = await createBrowserSupabaseClient().functions.invoke<T>(
    "chat-image-command",
    { body, timeout }
  );
  if (result.error || !result.data) {
    let message = result.error?.message;
    const context = result.error && "context" in result.error
      ? result.error.context
      : null;
    if (context instanceof Response) {
      const payload = await context.json().catch(() => null) as { error?: string } | null;
      message = payload?.error || message;
    }
    throw new Error(message || "That image action did not finish yet.");
  }
  return result.data;
}

interface WireReadyAttachment {
  id: string;
  kind: "image" | "file";
  original_name: string;
  stored_mime_type: string;
  stored_byte_size: number;
  width: number | null;
  height: number | null;
  thumbnail_path: string | null;
  display_path: string;
}

function publicTusEndpoint(): string {
  const url = new URL(getPublicEnv().supabaseUrl);
  const projectRef = url.hostname.endsWith(".supabase.co")
    ? url.hostname.slice(0, -".supabase.co".length)
    : null;

  return projectRef
    ? `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`
    : `${url.origin}/storage/v1/upload/resumable`;
}

function signedUploadUrl(
  bucket: string,
  objectPath: string,
  uploadToken: string
): string {
  const baseUrl = getPublicEnv().supabaseUrl.replace(/\/$/, "");
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodedPath}?token=${encodeURIComponent(uploadToken)}`;
}

export const chatImageService: ChatImageService = {
  async initialize(input): Promise<ChatImageUploadAuthorization> {
    const result = await invoke<Omit<ChatImageUploadAuthorization, "tusEndpoint">>({
      action: "initialize-upload",
      ...input,
    });

    // The Edge runtime's URL can be an internal Docker/function address. The
    // browser already has the canonical public project URL, so derive the TUS
    // gateway here instead of trusting a server-runtime origin.
    return {
      ...result,
      tusEndpoint: publicTusEndpoint(),
      signedUploadUrl: signedUploadUrl(
        result.bucket,
        result.objectPath,
        result.uploadToken
      ),
    };
  },
  async complete(attachmentId): Promise<ReadyChatImageUpload> {
    const result = await invoke<{
      attachment: WireReadyAttachment;
      urls: Array<{ path: string; signedUrl: string }>;
    }>({ action: "complete-upload", attachmentId }, 45_000);
    const urls = new Map(result.urls.map((item) => [item.path, item.signedUrl]));
    return {
      urls: result.urls,
      attachment: {
        id: result.attachment.id,
        status: "ready",
        kind: result.attachment.kind,
        originalName: result.attachment.original_name,
        mimeType: result.attachment.stored_mime_type,
        byteSize: result.attachment.stored_byte_size,
        width: result.attachment.width ?? undefined,
        height: result.attachment.height ?? undefined,
        thumbnailPath: result.attachment.thumbnail_path ?? undefined,
        displayPath: result.attachment.display_path,
        thumbnailUrl: result.attachment.thumbnail_path
          ? urls.get(result.attachment.thumbnail_path)
          : undefined,
        displayUrl: urls.get(result.attachment.display_path),
      },
    };
  },
  async cancel(attachmentId): Promise<void> {
    await invoke({ action: "cancel-upload", attachmentId });
  },
  async refreshUrls(attachmentIds) {
    const result = await invoke<{ urls: Array<{ path: string; signedUrl: string }> }>({
      action: "refresh-image-urls",
      attachmentIds,
    });
    return result.urls;
  },
};
