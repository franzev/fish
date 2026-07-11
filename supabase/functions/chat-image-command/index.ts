import {
  ImageMagick,
  MagickFormat,
  initializeImageMagick,
} from "npm:@imagemagick/magick-wasm@^0.0.35";
import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import { unzipSync } from "npm:fflate@0.8.2";

const bucket = "chat-images";
const maxStoredBytes = 5 * 1024 * 1024;
const maxEdge = 4096;
const maxPixels = 25_000_000;
const signedUrlSeconds = 15 * 60;
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const jsonHeaders = { "content-type": "application/json; charset=utf-8", ...corsHeaders };

type AttachmentRow = {
  id: string;
  conversation_id: string;
  message_id: string | null;
  uploader_id: string;
  kind: "image" | "file";
  status: string;
  staging_path: string;
  display_path: string | null;
  thumbnail_path: string | null;
  original_name: string;
  source_mime_type: string;
  source_byte_size: number;
  expires_at: string;
  width: number | null;
  height: number | null;
};

const fileExtensions: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};
const sourceExtensions: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"],
  ...Object.fromEntries(Object.entries(fileExtensions).map(([mime, extension]) => [mime, [extension]])),
};

function validateFile(bytes: Uint8Array, mime: string): boolean {
  if (mime === "application/pdf") {
    return bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  }
  if (mime === "text/plain" || mime === "text/csv") {
    if (bytes.includes(0)) return false;
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return true; } catch { return false; }
  }
  const expected = mime.includes("wordprocessingml") ? "word/"
    : mime.includes("spreadsheetml") ? "xl/"
    : mime.includes("presentationml") ? "ppt/" : null;
  if (!expected || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  try {
    const entries = Object.keys(unzipSync(bytes));
    return entries.includes("[Content_Types].xml") && entries.some((name) => name.startsWith(expected))
      && !entries.some((name) => /vbaProject\.bin$/i.test(name));
  } catch { return false; }
}

let magickReady: Promise<void> | null = null;

function calmError(code: string, error: string, status: number): Response {
  return Response.json({ code, error }, { status, headers: jsonHeaders });
}

async function ensureMagick(): Promise<void> {
  if (!magickReady) {
    magickReady = (async () => {
      const wasm = await Deno.readFile(
        new URL(
          "magick.wasm",
          import.meta.resolve("npm:@imagemagick/magick-wasm@^0.0.35"),
        ),
      );
      await initializeImageMagick(wasm);
    })();
  }
  await magickReady;
}

function isWebP(bytes: Uint8Array): boolean {
  return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

function fit(width: number, height: number, longestEdge: number) {
  const scale = Math.min(1, longestEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function makeVariant(
  bytes: Uint8Array,
  longestEdge: number,
  quality: number,
  targetBytes: number,
): Promise<{ bytes: Uint8Array; sourceWidth: number; sourceHeight: number }> {
  await ensureMagick();
  return ImageMagick.read(bytes, (image) => {
    image.autoOrient();
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    if (
      sourceWidth < 1 || sourceHeight < 1 || sourceWidth > maxEdge ||
      sourceHeight > maxEdge || sourceWidth * sourceHeight > maxPixels
    ) {
      throw new Error("unsafe_dimensions");
    }
    const size = fit(sourceWidth, sourceHeight, longestEdge);
    image.strip();
    image.resize(size.width, size.height);
    image.format = MagickFormat.WebP;
    let output = new Uint8Array();
    // A byte budget prevents high-detail images from becoming storage-cost
    // outliers. Step quality down gently and stop before visible degradation.
    for (let candidate = quality; candidate >= 56; candidate -= 6) {
      image.quality = candidate;
      output = image.write((data) => Uint8Array.from(data));
      if (output.length <= targetBytes) break;
    }
    return { bytes: output, sourceWidth, sourceHeight };
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return calmError("method_not_allowed", "Use a post request for image updates.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!publishableKey || !serviceKey || !authHeader) {
    return calmError("not_authenticated", "That image could not be prepared yet.", 401);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const user = userData.user;
  if (!user) {
    return calmError("not_authenticated", "That image could not be prepared yet.", 401);
  }

  let command: Record<string, unknown>;
  try {
    command = await request.json();
  } catch {
    return calmError("invalid_request", "That image could not be prepared yet.", 400);
  }

  if (command.action === "initialize-upload") {
    const conversationId = String(command.conversationId ?? "");
    const clientUploadId = String(command.clientUploadId ?? "");
    const originalName = String(command.originalName ?? "").slice(0, 255);
    const sourceMimeType = String(command.sourceMimeType ?? "");
    const sourceByteSize = Number(command.sourceByteSize ?? 0);
    const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
    if (!sourceExtensions[sourceMimeType]?.includes(extension)) {
      return calmError("unsupported_type", "That file name does not match its selected type.", 400);
    }
    const { data, error } = await caller.rpc("initialize_chat_image_upload", {
      p_conversation_id: conversationId,
      p_client_upload_id: clientUploadId,
      p_original_name: originalName,
      p_source_mime_type: sourceMimeType,
      p_source_byte_size: sourceByteSize,
    });
    if (error || !data) {
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("rate limit")) {
        return calmError("rate_limited", "You have added several files. Try again in a little while.", 429);
      }
      if (message.includes("too large")) {
        return calmError("too_large", "This file is over 10 MB. Try a smaller one.", 400);
      }
      if (message.includes("not supported")) {
        return calmError("unsupported_type", "That file type is not supported yet.", 400);
      }
      return calmError("not_authorized", "That image could not be added to this chat.", 403);
    }
    const attachment = (Array.isArray(data) ? data[0] : data) as AttachmentRow;
    const signed = await admin.storage.from(bucket).createSignedUploadUrl(
      attachment.staging_path,
    );
    if (signed.error || !signed.data) {
      return calmError("upload_unavailable", "That image could not be prepared yet. Try again.", 503);
    }
    return Response.json({
      attachmentId: attachment.id,
      bucket,
      objectPath: attachment.staging_path,
      uploadToken: signed.data.token,
      uploadMimeType: attachment.kind === "image" ? "image/webp" : attachment.source_mime_type,
      expiresAt: attachment.expires_at,
    }, { headers: jsonHeaders });
  }

  if (command.action === "complete-upload") {
    const attachmentId = String(command.attachmentId ?? "");
    const { data, error } = await admin.from("message_attachments").select("*")
      .eq("id", attachmentId).eq("uploader_id", user.id).maybeSingle();
    const attachment = data as AttachmentRow | null;
    if (error || !attachment || attachment.message_id) {
      return calmError("not_found", "That image is no longer available.", 404);
    }
    if (attachment.status === "ready") {
      const signed = await caller.storage.from(bucket).createSignedUrls(
        [attachment.thumbnail_path, attachment.display_path].filter((path): path is string => Boolean(path)),
        signedUrlSeconds,
      );
      return Response.json({ attachment, urls: signed.data ?? [] }, { headers: jsonHeaders });
    }
    if (new Date(attachment.expires_at).getTime() <= Date.now()) {
      return calmError("upload_expired", "That upload expired. Try the image again.", 410);
    }
    const claimed = await admin.from("message_attachments")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", attachment.id).eq("uploader_id", user.id)
      .in("status", ["pending", "uploaded", "failed"]).select("id");
    if (claimed.error || claimed.data?.length !== 1) {
      return calmError("processing", "That image is still being prepared.", 409);
    }

    const downloaded = await admin.storage.from(bucket).download(attachment.staging_path);
    if (downloaded.error || !downloaded.data) {
      await admin.from("message_attachments").update({ status: "failed", failure_code: "missing_upload" })
        .eq("id", attachment.id);
      return calmError("missing_upload", "That upload did not finish yet. Try again.", 409);
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const maxBytes = attachment.kind === "image" ? maxStoredBytes : 10 * 1024 * 1024;
    const validBytes = attachment.kind === "image"
      ? isWebP(bytes)
      : validateFile(bytes, attachment.source_mime_type);
    if (bytes.length < 1 || bytes.length > maxBytes || !validBytes) {
      await admin.from("message_attachments").update({ status: "failed", failure_code: "invalid_file" })
        .eq("id", attachment.id);
      await admin.storage.from(bucket).remove([attachment.staging_path]);
      return calmError("invalid_file", "That file does not match its selected type.", 400);
    }

    try {
      if (attachment.kind === "file") {
        const extension = fileExtensions[attachment.source_mime_type];
        if (!extension) throw new Error("unsupported_file");
        const filePath = `${attachment.conversation_id}/${attachment.id}/file.${extension}`;
        const uploaded = await admin.storage.from(bucket).upload(filePath, bytes, {
          contentType: attachment.source_mime_type, cacheControl: "3600", upsert: false,
        });
        if (uploaded.error) throw new Error("file_upload_failed");
        await admin.storage.from(bucket).remove([attachment.staging_path]);
        const ready = await admin.from("message_attachments").update({
          status: "ready", display_path: filePath, thumbnail_path: null,
          stored_mime_type: attachment.source_mime_type, stored_byte_size: bytes.length,
          width: null, height: null, failure_code: null, updated_at: new Date().toISOString(),
        }).eq("id", attachment.id).eq("uploader_id", user.id).select("*").single();
        if (ready.error) throw new Error("attachment_update_failed");
        const signed = await caller.storage.from(bucket).createSignedUrls([filePath], signedUrlSeconds);
        return Response.json({ attachment: ready.data, urls: signed.data ?? [] }, { headers: jsonHeaders });
      }
      const display = await makeVariant(bytes, 1920, 78, 1_250_000);
      const needsSeparateThumbnail = Math.max(display.sourceWidth, display.sourceHeight) > 64;
      const thumbnail = needsSeparateThumbnail
        ? await makeVariant(bytes, 64, 56, 16_000)
        : null;
      if (display.bytes.length > maxStoredBytes) throw new Error("processed_too_large");
      const base = `${attachment.conversation_id}/${attachment.id}`;
      const displayPath = `${base}/display.webp`;
      const thumbnailPath = thumbnail ? `${base}/thumbnail.webp` : displayPath;
      const displayUpload = await admin.storage.from(bucket).upload(displayPath, display.bytes, {
        contentType: "image/webp", cacheControl: "3600", upsert: false,
      });
      const thumbnailUpload = thumbnail
        ? await admin.storage.from(bucket).upload(thumbnailPath, thumbnail.bytes, {
            contentType: "image/webp", cacheControl: "3600", upsert: false,
          })
        : { error: null };
      if (displayUpload.error || thumbnailUpload.error) throw new Error("variant_upload_failed");
      await admin.storage.from(bucket).remove([attachment.staging_path]);
      const readyValues = {
        status: "ready",
        display_path: displayPath,
        thumbnail_path: thumbnailPath,
        stored_mime_type: "image/webp",
        stored_byte_size: display.bytes.length,
        width: display.sourceWidth,
        height: display.sourceHeight,
        failure_code: null,
        updated_at: new Date().toISOString(),
      };
      const ready = await admin.from("message_attachments").update(readyValues)
        .eq("id", attachment.id).eq("uploader_id", user.id).select("*").single();
      if (ready.error) throw new Error("attachment_update_failed");
      const signed = await caller.storage.from(bucket).createSignedUrls(
        [...new Set([thumbnailPath, displayPath])], signedUrlSeconds,
      );
      return Response.json({ attachment: ready.data, urls: signed.data ?? [] }, { headers: jsonHeaders });
    } catch (processingError) {
      console.error("chat attachment processing failed", { attachmentId, processingError });
      await admin.from("message_attachments").update({ status: "failed", failure_code: "processing_failed" })
        .eq("id", attachment.id);
      return calmError("processing_failed", "That file could not be prepared. Try another copy.", 422);
    }
  }

  if (command.action === "cancel-upload") {
    const attachmentId = String(command.attachmentId ?? "");
    const { data } = await admin.from("message_attachments").select("*")
      .eq("id", attachmentId).eq("uploader_id", user.id).is("message_id", null).maybeSingle();
    const attachment = data as AttachmentRow | null;
    if (!attachment) return Response.json({ cancelled: true }, { headers: jsonHeaders });
    await admin.storage.from(bucket).remove(
      [attachment.staging_path, attachment.display_path, attachment.thumbnail_path]
        .filter((path): path is string => Boolean(path)),
    );
    await admin.from("message_attachments").update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", attachment.id).eq("uploader_id", user.id);
    return Response.json({ cancelled: true }, { headers: jsonHeaders });
  }

  if (command.action === "refresh-image-urls") {
    const attachmentIds = Array.isArray(command.attachmentIds)
      ? [...new Set(command.attachmentIds.map(String))].slice(0, 50)
      : [];
    if (attachmentIds.length === 0) {
      return calmError("invalid_request", "Those images are not available.", 400);
    }
    const { data, error } = await caller.from("message_attachments")
      .select("id, thumbnail_path, display_path").in("id", attachmentIds).eq("status", "ready");
    if (error || !data || data.length !== attachmentIds.length) {
      return calmError("not_authorized", "Those images are not available.", 403);
    }
    const paths = data.flatMap((row) => [row.thumbnail_path, row.display_path]).filter(Boolean) as string[];
    const signed = await caller.storage.from(bucket).createSignedUrls(paths, signedUrlSeconds);
    if (signed.error) return calmError("delivery_unavailable", "Those images did not load yet. Try again.", 503);
    return Response.json({ expiresAt: new Date(Date.now() + signedUrlSeconds * 1000).toISOString(), urls: signed.data }, { headers: jsonHeaders });
  }

  return calmError("invalid_request", "That image action is not available.", 400);
});
