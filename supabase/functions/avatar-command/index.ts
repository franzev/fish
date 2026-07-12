import {
  ImageMagick,
  MagickFormat,
  initializeImageMagick,
} from "npm:@imagemagick/magick-wasm@^0.0.35";
import { createClient } from "npm:@supabase/supabase-js@2.110.0";

const bucket = "avatars";
const signedUrlSeconds = 24 * 60 * 60;
const maxSourceBytes = 10 * 1024 * 1024;
const maxUploadBytes = 2 * 1024 * 1024;
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const jsonHeaders = { "content-type": "application/json; charset=utf-8", ...corsHeaders };
const sourceExtensions: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

type AvatarUploadRow = {
  id: string;
  user_id: string;
  status: "pending" | "processing" | "ready" | "failed" | "cancelled" | "superseded";
  staging_path: string;
  avatar_path: string | null;
  thumbnail_path: string | null;
  expires_at: string;
  created_at: string;
};

type AvatarPathRow = { profile_id: string; object_path: string };
type PublishRow = {
  published: boolean;
  old_avatar_path: string | null;
  old_thumbnail_path: string | null;
  published_at: string | null;
};

function calmError(code: string, error: string, status: number): Response {
  return Response.json({ code, error }, { status, headers: jsonHeaders });
}

function enabled(): boolean {
  return (Deno.env.get("AVATAR_UPLOADS_ENABLED") ?? "true").toLowerCase() !== "false";
}

function isWebP(bytes: Uint8Array): boolean {
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

let magickReady: Promise<void> | null = null;
async function ensureMagick(): Promise<void> {
  if (!magickReady) {
    magickReady = (async () => {
      const wasm = await Deno.readFile(
        new URL("magick.wasm", import.meta.resolve("npm:@imagemagick/magick-wasm@^0.0.35")),
      );
      await initializeImageMagick(wasm);
    })();
  }
  await magickReady;
}

async function inspectUpload(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  await ensureMagick();
  return ImageMagick.read(bytes, (image) => {
    image.autoOrient();
    const width = image.width;
    const height = image.height;
    if (width !== height || width < 128 || width > 1024 || height < 128 || height > 1024) {
      throw new Error("unsafe_dimensions");
    }
    return { width, height };
  });
}

async function makeVariant(
  bytes: Uint8Array,
  maxSize: number,
  quality: number,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  await ensureMagick();
  return ImageMagick.read(bytes, (image) => {
    image.autoOrient();
    image.strip();
    const size = Math.min(maxSize, image.width, image.height);
    image.resize(size, size);
    image.format = MagickFormat.WebP;
    image.quality = quality;
    return {
      bytes: image.write((data) => Uint8Array.from(data)),
      width: image.width,
      height: image.height,
    };
  });
}

function uploadUrl(supabaseUrl: string, objectPath: string, token: string): string {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/upload/sign/${bucket}/${encodedPath}?token=${encodeURIComponent(token)}`;
}

async function signedAvatarUrls(
  admin: ReturnType<typeof createClient>,
  paths: string[],
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return new Map();
  const signed = await admin.storage.from(bucket).createSignedUrls(uniquePaths, signedUrlSeconds);
  if (signed.error) throw signed.error;
  return new Map(
    (signed.data ?? [])
      .filter((item) => item.path && item.signedUrl)
      .map((item) => [item.path, item.signedUrl] as const),
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return calmError("method_not_allowed", "Use a post request for avatar updates.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")
    ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!publishableKey || !serviceKey || !authHeader) {
    return calmError("not_authenticated", "Your session expired. Sign in again to save.", 401);
  }

  let command: Record<string, unknown>;
  try {
    command = await request.json();
  } catch {
    return calmError("invalid_request", "That avatar request could not be read.", 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (command.action === "cleanup-expired") {
    if (authHeader !== `Bearer ${serviceKey}`) {
      return calmError("not_authorized", "That cleanup request is not available.", 403);
    }
    const cutoff = new Date().toISOString();
    const oldReadyCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: uploads, error } = await admin.from("avatar_uploads").select("*")
      .or(`expires_at.lt.${cutoff},and(status.eq.ready,updated_at.lt.${oldReadyCutoff})`)
      .limit(100);
    if (error) return calmError("cleanup_failed", "Avatar cleanup did not finish.", 503);
    let objectsRemoved = 0;
    let rowsRemoved = 0;
    for (const upload of (uploads ?? []) as AvatarUploadRow[]) {
      if (upload.status === "ready" && upload.avatar_path) {
        const { count } = await admin.from("profiles").select("id", { count: "exact", head: true })
          .eq("avatar_path", upload.avatar_path);
        if ((count ?? 0) > 0) continue;
      }
      const paths = [upload.staging_path, upload.avatar_path, upload.thumbnail_path]
        .filter((path): path is string => Boolean(path));
      if (paths.length > 0) {
        const removed = await admin.storage.from(bucket).remove(paths);
        if (!removed.error) objectsRemoved += paths.length;
      }
      const deleted = await admin.from("avatar_uploads").delete().eq("id", upload.id);
      if (!deleted.error) rowsRemoved += 1;
    }
    return Response.json({ rowsRemoved, objectsRemoved }, { headers: jsonHeaders });
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const user = userData.user;
  if (!user) return calmError("not_authenticated", "Your session expired. Sign in again to save.", 401);

  if (command.action === "resolve-urls") {
    const profileIds = Array.isArray(command.profileIds)
      ? command.profileIds.filter((value): value is string => typeof value === "string").slice(0, 101)
      : [];
    const variant = command.variant === "display" ? "display" : "thumbnail";
    if (profileIds.length > 100) return calmError("too_many_profiles", "Too many avatars were requested.", 400);
    const { data, error } = await caller.rpc("resolve_avatar_paths", {
      p_profile_ids: profileIds,
      p_variant: variant,
    });
    if (error) return calmError("not_authorized", "Those avatars are not available.", 403);
    const rows = (data ?? []) as AvatarPathRow[];
    const urls = await signedAvatarUrls(admin, rows.map((row) => row.object_path));
    const expiresAt = new Date(Date.now() + signedUrlSeconds * 1000).toISOString();
    return Response.json({
      items: rows.flatMap((row) => {
        const url = urls.get(row.object_path);
        return url ? [{ profileId: row.profile_id, url, expiresAt }] : [];
      }),
    }, { headers: jsonHeaders });
  }

  if (!enabled()) {
    return calmError("feature_unavailable", "Avatar updates are resting for a moment. Try again later.", 503);
  }

  if (command.action === "initialize-upload") {
    const clientUploadId = String(command.clientUploadId ?? "");
    const originalName = String(command.originalName ?? "").slice(0, 255);
    const sourceMimeType = String(command.sourceMimeType ?? "").toLowerCase();
    const sourceByteSize = Number(command.sourceByteSize ?? 0);
    const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
    if (!sourceExtensions[sourceMimeType]?.includes(extension)) {
      return calmError("unsupported_type", "Choose a JPG, PNG, or WebP photo.", 400);
    }
    if (sourceByteSize < 1 || sourceByteSize > maxSourceBytes) {
      return calmError("too_large", "This photo is over 10 MB. Try a smaller one.", 400);
    }
    const { data, error } = await caller.rpc("initialize_avatar_upload", {
      p_client_upload_id: clientUploadId,
      p_original_name: originalName,
      p_source_mime_type: sourceMimeType,
      p_source_byte_size: sourceByteSize,
    });
    if (error || !data) {
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("rate limit")) {
        return calmError("rate_limited", "You have tried several photos. Give it a little time and try again.", 429);
      }
      if (message.includes("too large")) return calmError("too_large", "This photo is over 10 MB. Try a smaller one.", 400);
      if (message.includes("not supported")) return calmError("unsupported_type", "Choose a JPG, PNG, or WebP photo.", 400);
      return calmError("invalid_request", "That photo could not be prepared yet. Try again.", 400);
    }
    const upload = (Array.isArray(data) ? data[0] : data) as AvatarUploadRow;
    if (["cancelled", "superseded"].includes(upload.status)) {
      return calmError("upload_expired", "That photo selection expired. Choose it again.", 410);
    }
    const signed = await admin.storage.from(bucket).createSignedUploadUrl(upload.staging_path);
    if (signed.error || !signed.data) {
      return calmError("upload_unavailable", "That photo could not start uploading. Try again.", 503);
    }
    return Response.json({
      uploadId: upload.id,
      bucket,
      objectPath: upload.staging_path,
      uploadToken: signed.data.token,
      signedUploadUrl: uploadUrl(supabaseUrl, upload.staging_path, signed.data.token),
      expiresAt: upload.expires_at,
    }, { headers: jsonHeaders });
  }

  if (command.action === "complete-upload") {
    const uploadId = String(command.uploadId ?? "");
    const { data, error } = await admin.from("avatar_uploads").select("*")
      .eq("id", uploadId).eq("user_id", user.id).maybeSingle();
    const upload = data as AvatarUploadRow | null;
    if (error || !upload) return calmError("not_found", "That photo upload is no longer available.", 404);
    if (upload.status === "ready" && upload.avatar_path && upload.thumbnail_path) {
      const urls = await signedAvatarUrls(admin, [upload.avatar_path, upload.thumbnail_path]);
      return Response.json({
        profileId: user.id,
        avatarUrl: urls.get(upload.avatar_path),
        avatarThumbnailUrl: urls.get(upload.thumbnail_path),
        updatedAt: new Date().toISOString(),
      }, { headers: jsonHeaders });
    }
    if (upload.status === "processing") {
      return calmError("processing", "That photo is still being prepared.", 409);
    }
    if (["cancelled", "superseded"].includes(upload.status)) {
      return calmError("superseded", "A newer photo selection replaced this one.", 409);
    }
    if (new Date(upload.expires_at).getTime() <= Date.now()) {
      return calmError("upload_expired", "That photo upload expired. Choose it again.", 410);
    }
    const claimed = await admin.from("avatar_uploads")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", upload.id).eq("user_id", user.id).in("status", ["pending", "failed"])
      .select("id");
    if (claimed.error || claimed.data?.length !== 1) {
      return calmError("processing", "That photo is still being prepared.", 409);
    }
    const downloaded = await admin.storage.from(bucket).download(upload.staging_path);
    if (downloaded.error || !downloaded.data) {
      await admin.from("avatar_uploads").update({ status: "failed", failure_code: "missing_upload" }).eq("id", upload.id);
      return calmError("missing_upload", "That photo did not finish uploading. Try again.", 409);
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (bytes.length < 1 || bytes.length > maxUploadBytes || !isWebP(bytes)) {
      await admin.from("avatar_uploads").update({ status: "failed", failure_code: "invalid_file" }).eq("id", upload.id);
      await admin.storage.from(bucket).remove([upload.staging_path]);
      return calmError("invalid_file", "That file does not match the prepared photo.", 400);
    }
    try {
      await inspectUpload(bytes);
      const display = await makeVariant(bytes, 512, 82);
      const thumbnail = await makeVariant(bytes, 128, 76);
      const base = `${user.id}/${upload.id}`;
      const avatarPath = `${base}/avatar.webp`;
      const thumbnailPath = `${base}/thumbnail.webp`;
      const displayUpload = await admin.storage.from(bucket).upload(avatarPath, display.bytes, {
        contentType: "image/webp", cacheControl: "86400", upsert: false,
      });
      const thumbnailUpload = await admin.storage.from(bucket).upload(thumbnailPath, thumbnail.bytes, {
        contentType: "image/webp", cacheControl: "86400", upsert: false,
      });
      if (displayUpload.error || thumbnailUpload.error) throw new Error("variant_upload_failed");
      const publishedResult = await admin.rpc("publish_avatar_upload", {
        p_user_id: user.id,
        p_upload_id: upload.id,
        p_avatar_path: avatarPath,
        p_thumbnail_path: thumbnailPath,
        p_stored_byte_size: display.bytes.length + thumbnail.bytes.length,
        p_stored_width: display.width,
        p_stored_height: display.height,
      });
      const published = (Array.isArray(publishedResult.data) ? publishedResult.data[0] : publishedResult.data) as PublishRow | null;
      if (publishedResult.error || !published?.published) {
        await admin.storage.from(bucket).remove([avatarPath, thumbnailPath, upload.staging_path]);
        return calmError("superseded", "A newer photo selection replaced this one.", 409);
      }
      await admin.storage.from(bucket).remove([upload.staging_path]);
      const oldPaths = [published.old_avatar_path, published.old_thumbnail_path]
        .filter((path): path is string => Boolean(path));
      if (oldPaths.length > 0) await admin.storage.from(bucket).remove(oldPaths);
      const urls = await signedAvatarUrls(admin, [avatarPath, thumbnailPath]);
      return Response.json({
        profileId: user.id,
        avatarUrl: urls.get(avatarPath),
        avatarThumbnailUrl: urls.get(thumbnailPath),
        updatedAt: published.published_at,
      }, { headers: jsonHeaders });
    } catch (processingError) {
      console.error("avatar processing failed", { uploadId: upload.id, processingError });
      await admin.from("avatar_uploads").update({ status: "failed", failure_code: "processing_failed" }).eq("id", upload.id);
      return calmError("processing_failed", "We could not prepare that photo. Try another copy.", 422);
    }
  }

  if (command.action === "cancel-upload") {
    const uploadId = String(command.uploadId ?? "");
    const { data } = await admin.from("avatar_uploads").select("*")
      .eq("id", uploadId).eq("user_id", user.id).maybeSingle();
    const upload = data as AvatarUploadRow | null;
    if (!upload || upload.status === "ready") return Response.json({ cancelled: true }, { headers: jsonHeaders });
    await admin.from("avatar_uploads").update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", upload.id).eq("user_id", user.id);
    await admin.storage.from(bucket).remove(
      [upload.staging_path, upload.avatar_path, upload.thumbnail_path]
        .filter((path): path is string => Boolean(path)),
    );
    return Response.json({ cancelled: true }, { headers: jsonHeaders });
  }

  if (command.action === "remove-avatar") {
    const removed = await admin.rpc("remove_profile_avatar", { p_user_id: user.id });
    if (removed.error) return calmError("remove_failed", "That photo could not be removed yet. Try again.", 503);
    const row = (Array.isArray(removed.data) ? removed.data[0] : removed.data) as {
      old_avatar_path: string | null;
      old_thumbnail_path: string | null;
    } | null;
    const paths = [row?.old_avatar_path, row?.old_thumbnail_path]
      .filter((path): path is string => Boolean(path));
    if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
    return Response.json({ removed: true }, { headers: jsonHeaders });
  }

  return calmError("invalid_action", "That avatar action is not available.", 400);
});
