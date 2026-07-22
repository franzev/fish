import {
  ConfigurationFiles,
  ImageMagick,
  MagickFormat,
  MagickReadSettings,
  initializeImageMagick,
} from "npm:@imagemagick/magick-wasm@^0.0.35";
import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import {
  attachmentLimits,
  extensionForDocumentMime,
  inspectNormalizedImage,
  inspectDocument,
  isVideoMime,
  isValidSha256,
  kindForSourceMime,
  sanitizeAttachmentName,
  scanDocument,
  sha256Hex,
  sourceNameMatchesMime,
} from "../_shared/chat-attachment-security.ts";

const bucket = "chat-images";
const maxEdge = 4096;
const signedUrlSeconds = 15 * 60;
const documentedUploadCredentialSeconds = 2 * 60 * 60;
const completionLeaseSeconds = 5 * 60;
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-expose-headers": "retry-after",
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
  stored_byte_size: number | null;
  upload_sha256: string | null;
  verified_sha256: string | null;
  integrity_status: string;
  scan_status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  upload_credentials_expires_at: string | null;
  width: number | null;
  height: number | null;
};

type AdminClient = ReturnType<typeof createClient>;

let magickReady: Promise<void> | null = null;

function calmError(
  code: string,
  error: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json({ code, error }, {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  });
}

function uploadCredentialExpiresAt(token: string): string {
  const documentedFloor = Date.now() + documentedUploadCredentialSeconds * 1000;
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) throw new Error("missing JWT payload");
    const base64 = encodedPayload.replaceAll("-", "+").replaceAll("_", "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(base64)) as { exp?: unknown };
    const expiresAt = Number(payload.exp) * 1000;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new Error("invalid JWT expiry");
    }
    return new Date(Math.max(documentedFloor, expiresAt)).toISOString();
  } catch {
    // The pinned Storage client documents a two-hour lifetime. If its token
    // format ever changes, retaining the row for that full window is safer
    // than exposing an untracked replay credential.
    return new Date(documentedFloor).toISOString();
  }
}

function completionLeaseRetryAfter(updatedAt: string | null | undefined): string {
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  if (!Number.isFinite(updatedAtMs)) return String(completionLeaseSeconds);
  return String(Math.max(
    1,
    Math.ceil((updatedAtMs + completionLeaseSeconds * 1000 - Date.now()) / 1000),
  ));
}

async function ensureMagick(): Promise<void> {
  if (!magickReady) {
    magickReady = (async () => {
      const wasm = await Deno.readFile(
        new URL("magick.wasm", import.meta.resolve("npm:@imagemagick/magick-wasm@^0.0.35")),
      );
      const configuration = ConfigurationFiles.default;
      configuration.policy.data = configuration.policy.data.replace(
        "</policymap>",
        `  <policy domain="resource" name="memory" value="96MiB" />
  <policy domain="resource" name="map" value="128MiB" />
  <policy domain="resource" name="width" value="4096" />
  <policy domain="resource" name="height" value="4096" />
  <policy domain="resource" name="area" value="25MP" />
  <policy domain="resource" name="list-length" value="1" />
  <policy domain="resource" name="thread" value="1" />
</policymap>`,
      );
      await initializeImageMagick(wasm, configuration);
    })();
  }
  await magickReady;
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
  const settings = new MagickReadSettings({ frameIndex: 0, frameCount: 1 });
  return ImageMagick.read(bytes, settings, (image) => {
    image.autoOrient();
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    if (
      sourceWidth < 1 || sourceHeight < 1 || sourceWidth > maxEdge
      || sourceHeight > maxEdge || sourceWidth * sourceHeight > attachmentLimits.maxImagePixels
    ) {
      throw new Error("unsafe_dimensions");
    }
    const size = fit(sourceWidth, sourceHeight, longestEdge);
    image.strip();
    image.resize(size.width, size.height);
    image.format = MagickFormat.WebP;
    let output = new Uint8Array();
    for (let candidate = quality; candidate >= 56; candidate -= 6) {
      image.quality = candidate;
      output = image.write((data) => Uint8Array.from(data));
      if (output.length <= targetBytes) break;
    }
    return { bytes: output, sourceWidth, sourceHeight };
  });
}

async function downloadObjectBytes(client: AdminClient, path: string): Promise<Uint8Array | null> {
  const downloaded = await client.storage.from(bucket).download(path);
  if (downloaded.error || !downloaded.data) return null;
  return new Uint8Array(await downloaded.data.arrayBuffer());
}

async function uploadOrReuseObject(input: {
  client: AdminClient;
  path: string;
  bytes: Uint8Array;
  contentType: string;
  isReusable: (existing: Uint8Array) => Promise<boolean> | boolean;
}): Promise<boolean> {
  const existing = await downloadObjectBytes(input.client, input.path);
  if (existing && await input.isReusable(existing)) return true;
  if (existing) await input.client.storage.from(bucket).remove([input.path]);
  const uploaded = await input.client.storage.from(bucket).upload(input.path, input.bytes, {
    contentType: input.contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (!uploaded.error) return true;
  const raced = await downloadObjectBytes(input.client, input.path);
  return Boolean(raced && await input.isReusable(raced));
}

async function isExactObject(existing: Uint8Array, expected: Uint8Array): Promise<boolean> {
  return existing.length === expected.length
    && await sha256Hex(existing) === await sha256Hex(expected);
}

function isExpectedWebp(existing: Uint8Array, width: number, height: number): boolean {
  const inspection = inspectNormalizedImage(existing);
  return inspection.ok && inspection.format === "webp"
    && inspection.width === width && inspection.height === height
    && existing.length <= attachmentLimits.normalizedImageBytes;
}

function tusEndpoint(supabaseUrl: string): string {
  const url = new URL(supabaseUrl);
  const projectRef = url.hostname.endsWith(".supabase.co")
    ? url.hostname.slice(0, -".supabase.co".length)
    : null;
  return projectRef
    ? `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`
    : `${url.origin}/storage/v1/upload/resumable`;
}

function signedUploadUrl(supabaseUrl: string, objectPath: string, token: string): string {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/upload/sign/${bucket}/${encodedPath}?token=${encodeURIComponent(token)}`;
}

async function signAttachmentPaths(
  client: AdminClient,
  attachment: AttachmentRow,
) {
  const paths = [...new Set([attachment.thumbnail_path, attachment.display_path].filter(
    (path): path is string => Boolean(path),
  ))];
  if (paths.length === 0) return [];
  const signed = await client.storage.from(bucket).createSignedUrls(paths, signedUrlSeconds);
  return signed.data ?? [];
}

function secureEquals(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

async function cleanupExpired(admin: AdminClient, request: Request): Promise<Response> {
  const expectedSecret = Deno.env.get("CHAT_ATTACHMENT_CLEANUP_SECRET")?.trim() ?? "";
  const providedSecret = request.headers.get("x-cleanup-secret")?.trim() ?? "";
  if (expectedSecret.length < 32 || !secureEquals(expectedSecret, providedSecret)) {
    return calmError("not_authorized", "That cleanup request is not available.", 401);
  }

  const startedAt = new Date();
  const claimToken = crypto.randomUUID();
  const stagingClaimToken = crypto.randomUUID();
  // Claim whole-row expiry first so an expired unbound ready row is deleted
  // rather than being temporarily captured by the staging-only pass.
  const claimedResult = await admin.rpc("claim_chat_attachment_cleanup", {
    p_claim_token: claimToken,
    p_limit: 100,
  });
  const stagingClaimedResult = claimedResult.error
    ? { data: null, error: null }
    : await admin.rpc("claim_chat_attachment_staging_cleanup", {
      p_claim_token: stagingClaimToken,
      p_limit: 100,
    });
  if (claimedResult.error || stagingClaimedResult.error) {
    if (!claimedResult.error) {
      await admin.rpc("finish_chat_attachment_cleanup", {
        p_claim_token: claimToken,
        p_deleted_ids: [],
      });
    }
    if (!stagingClaimedResult.error) {
      await admin.rpc("finish_chat_attachment_staging_cleanup", {
        p_claim_token: stagingClaimToken,
        p_deleted_ids: [],
      });
    }
    console.error("chat attachment cleanup claim failed", {
      fullCode: claimedResult.error?.code,
      stagingCode: stagingClaimedResult.error?.code,
    });
    return calmError("cleanup_unavailable", "Attachment cleanup will try again later.", 503);
  }
  const claimed = (claimedResult.data ?? []) as AttachmentRow[];
  const stagingClaimed = (stagingClaimedResult.data ?? []) as AttachmentRow[];
  const deletedIds: string[] = [];
  const stagingDeletedIds: string[] = [];
  let deletedBytes = 0;
  for (const attachment of claimed) {
    const paths = [...new Set([
      attachment.staging_path,
      attachment.display_path,
      attachment.thumbnail_path,
    ].filter((path): path is string => Boolean(path)))];
    const removed = paths.length > 0
      ? await admin.storage.from(bucket).remove(paths)
      : { error: null };
    if (!removed.error) {
      deletedIds.push(attachment.id);
      deletedBytes += attachment.stored_byte_size ?? attachment.source_byte_size ?? 0;
    }
  }
  for (const attachment of stagingClaimed) {
    const removed = await admin.storage.from(bucket).remove([attachment.staging_path]);
    if (!removed.error) {
      stagingDeletedIds.push(attachment.id);
      deletedBytes += attachment.source_byte_size ?? 0;
    }
  }
  const [finished, stagingFinished] = await Promise.all([
    admin.rpc("finish_chat_attachment_cleanup", {
      p_claim_token: claimToken,
      p_deleted_ids: deletedIds,
    }),
    admin.rpc("finish_chat_attachment_staging_cleanup", {
      p_claim_token: stagingClaimToken,
      p_deleted_ids: stagingDeletedIds,
    }),
  ]);
  if (finished.error || stagingFinished.error) {
    console.error("chat attachment cleanup finish failed", {
      fullCode: finished.error?.code,
      stagingCode: stagingFinished.error?.code,
    });
    return calmError("cleanup_unavailable", "Attachment cleanup will try again later.", 503);
  }
  const claimedCount = claimed.length + stagingClaimed.length;
  const deletedCount = deletedIds.length + stagingDeletedIds.length;
  await admin.from("chat_attachment_cleanup_runs").insert({
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    claimed_count: claimedCount,
    deleted_count: deletedCount,
    failed_count: claimedCount - deletedCount,
    deleted_bytes: deletedBytes,
    oldest_created_at: [...claimed, ...stagingClaimed]
      .map((item) => item.created_at).sort()[0] ?? null,
  });
  return Response.json({
    claimed: claimedCount,
    deleted: deletedCount,
    failed: claimedCount - deletedCount,
    stagingClaimed: stagingClaimed.length,
    stagingDeleted: stagingDeletedIds.length,
  }, { headers: jsonHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return calmError("method_not_allowed", "Use a post request for attachment updates.", 405);
  }

  let command: Record<string, unknown>;
  try {
    command = await request.json();
  } catch {
    return calmError("invalid_request", "That attachment request could not be read.", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(request.url).origin;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")
    ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    return calmError("service_unavailable", "Attachments are not available yet. Try again.", 503);
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (command.action === "cleanup-expired") return await cleanupExpired(admin, request);

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!publishableKey || !authHeader) {
    return calmError("not_authenticated", "Sign in to continue adding attachments.", 401);
  }
  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const user = userData.user;
  if (!user) return calmError("not_authenticated", "Sign in to continue adding attachments.", 401);

  if (command.action === "initialize-upload") {
    const conversationId = String(command.conversationId ?? "");
    const clientUploadId = String(command.clientUploadId ?? "");
    const sourceMimeType = String(command.sourceMimeType ?? "").toLowerCase();
    const kind = kindForSourceMime(sourceMimeType);
    const rawOriginalName = String(command.originalName ?? "");
    const sourceByteSize = Number(command.sourceByteSize ?? 0);
    const uploadSha256 = command.uploadSha256 == null ? null : String(command.uploadSha256).toLowerCase();
    const requestedUploadMimeType = String(command.uploadMimeType ?? "").toLowerCase();
    if (!kind || !sourceNameMatchesMime(rawOriginalName, sourceMimeType)) {
      return calmError("unsupported_type", "That file type is not supported yet.", 400);
    }
    const maxSourceBytes = kind === "image"
      ? attachmentLimits.imageSourceBytes
      : isVideoMime(sourceMimeType)
      ? attachmentLimits.videoSourceBytes
      : attachmentLimits.documentSourceBytes;
    if (!Number.isSafeInteger(sourceByteSize) || sourceByteSize < 1 || sourceByteSize > maxSourceBytes) {
      const limit = kind === "image" || isVideoMime(sourceMimeType) ? "25 MB" : "10 MB";
      return calmError("too_large", `This ${kind === "image" ? "photo" : "file"} is over ${limit}. Try a smaller one.`, 400);
    }
    if (uploadSha256 !== null && !isValidSha256(uploadSha256)) {
      return calmError("invalid_hash", "That attachment could not be verified. Choose it again.", 400);
    }
    if (rawOriginalName.length > 1024 || clientUploadId.length < 1 || clientUploadId.length > 120) {
      return calmError("invalid_request", "That attachment could not be prepared yet.", 400);
    }
    const originalName = sanitizeAttachmentName(rawOriginalName, kind);
    const initialized = await caller.rpc("initialize_chat_attachment_upload", {
      p_conversation_id: conversationId,
      p_client_upload_id: clientUploadId,
      p_original_name: originalName,
      p_source_mime_type: sourceMimeType,
      p_source_byte_size: sourceByteSize,
      p_upload_sha256: uploadSha256,
    });
    if (initialized.error || !initialized.data) {
      const message = initialized.error?.message?.toLowerCase() ?? "";
      if (message.includes("short rate limit") || message.includes("daily rate limit")) {
        const parsedRetryAfter = Number(message.match(/retry after (\d+) seconds/)?.[1] ?? 1);
        const retryAfter = String(Math.max(1, Math.min(86_400, parsedRetryAfter)));
        const daily = message.includes("daily rate limit");
        return calmError(
          daily ? "rate_limited_daily" : "rate_limited_short",
          daily
            ? "You have added several files today. Try again later."
            : "You have added several files. Try again in a little while.",
          429,
          { "retry-after": retryAfter },
        );
      }
      if (message.includes("too large")) {
        return calmError("too_large", "That attachment is too large. Try a smaller one.", 400);
      }
      if (message.includes("not supported")) {
        return calmError("unsupported_type", "That file type is not supported yet.", 400);
      }
      if (message.includes("conflicts")) {
        return calmError("upload_conflict", "That upload changed. Add the attachment again.", 409);
      }
      return calmError("not_authorized", "That attachment could not be added to this chat.", 403);
    }
    const attachment = (Array.isArray(initialized.data) ? initialized.data[0] : initialized.data) as AttachmentRow;
    if (attachment.status === "ready") {
      return Response.json({
        status: "ready",
        attachmentId: attachment.id,
        attachment,
        urls: await signAttachmentPaths(caller, attachment),
      }, { headers: jsonHeaders });
    }
    if (attachment.message_id || !["pending", "uploaded", "failed"].includes(attachment.status)) {
      return calmError("upload_unavailable", "That attachment is already being checked.", 409);
    }
    const signed = await admin.storage.from(bucket).createSignedUploadUrl(
      attachment.staging_path,
      { upsert: false },
    );
    if (signed.error || !signed.data) {
      return calmError("upload_unavailable", "That attachment could not be prepared yet. Try again.", 503);
    }
    const credentialExpiry = uploadCredentialExpiresAt(signed.data.token);
    const recordedCredential = await admin.rpc("record_chat_attachment_upload_credential", {
      p_attachment_id: attachment.id,
      p_expires_at: credentialExpiry,
    });
    if (recordedCredential.error || typeof recordedCredential.data !== "string") {
      return calmError("upload_unavailable", "That attachment could not be prepared yet. Try again.", 503);
    }
    return Response.json({
      attachmentId: attachment.id,
      bucket,
      objectPath: attachment.staging_path,
      uploadToken: signed.data.token,
      uploadMimeType: attachment.kind === "image"
        ? (["image/webp", "image/jpeg"].includes(requestedUploadMimeType)
          ? requestedUploadMimeType
          : "image/webp")
        : attachment.source_mime_type,
      tusEndpoint: tusEndpoint(supabaseUrl),
      tusHeaders: { "x-signature": signed.data.token },
      signedUploadUrl: signedUploadUrl(supabaseUrl, attachment.staging_path, signed.data.token),
      expiresAt: recordedCredential.data,
    }, { headers: jsonHeaders });
  }

  if (command.action === "complete-upload") {
    const attachmentId = String(command.attachmentId ?? "");
    const fetched = await admin.from("message_attachments").select("*")
      .eq("id", attachmentId).eq("uploader_id", user.id).maybeSingle();
    let attachment = fetched.data as AttachmentRow | null;
    if (fetched.error || !attachment) {
      return calmError("not_found", "That attachment is no longer available.", 404);
    }
    if (attachment.status === "ready") {
      return Response.json({ attachment, urls: await signAttachmentPaths(caller, attachment) }, { headers: jsonHeaders });
    }
    if (attachment.message_id) {
      return calmError("not_found", "That attachment is no longer available.", 404);
    }
    if (new Date(attachment.expires_at).getTime() <= Date.now()) {
      return calmError("upload_expired", "That upload expired. Add the attachment again.", 410);
    }
    if (["integrity_mismatch", "invalid_file", "macro_not_allowed", "malware_detected"].includes(
      String((fetched.data as Record<string, unknown>).failure_code ?? ""),
    )) {
      return calmError("invalid_file", "That file did not pass its safety check. Choose another copy.", 422);
    }
    const leaseStartedAt = new Date().toISOString();
    const staleLeaseBefore = new Date(Date.now() - 5 * 60_000).toISOString();
    const claimed = await admin.from("message_attachments")
      .update({ status: "processing", failure_code: null, updated_at: leaseStartedAt })
      .eq("id", attachment.id).eq("uploader_id", user.id)
      .or(`status.in.(pending,uploaded,failed),and(status.in.(processing,pending_scan),updated_at.lt.${staleLeaseBefore})`)
      .select("*").maybeSingle();
    if (claimed.error || !claimed.data) {
      // A concurrent completion can acquire the lease after our initial read.
      // Read its timestamp rather than directing the caller from a stale
      // pre-race snapshot.
      const latest = await admin.from("message_attachments").select("*")
        .eq("id", attachment.id).eq("uploader_id", user.id).maybeSingle();
      const latestAttachment = latest.data as AttachmentRow | null;
      if (!latest.error && latestAttachment?.status === "ready") {
        return Response.json({
          attachment: latestAttachment,
          urls: await signAttachmentPaths(caller, latestAttachment),
        }, { headers: jsonHeaders });
      }
      return calmError(
        "processing",
        "That attachment is still being checked.",
        409,
        { "retry-after": completionLeaseRetryAfter(latestAttachment?.updated_at ?? attachment.updated_at) },
      );
    }
    attachment = claimed.data as AttachmentRow;

    const downloaded = await admin.storage.from(bucket).download(attachment.staging_path);
    if (downloaded.error || !downloaded.data) {
      await admin.from("message_attachments").update({ status: "failed", failure_code: "missing_upload" })
        .eq("id", attachment.id).eq("status", "processing");
      return calmError("missing_upload", "That upload did not finish yet. Try again.", 409);
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const maxBytes = attachment.kind === "image"
      ? attachmentLimits.normalizedImageBytes
      : isVideoMime(attachment.source_mime_type)
      ? attachmentLimits.videoSourceBytes
      : attachmentLimits.documentSourceBytes;
    if (bytes.length < 1 || bytes.length > maxBytes) {
      await admin.from("message_attachments").update({ status: "failed", failure_code: "invalid_file" })
        .eq("id", attachment.id).eq("status", "processing");
      await admin.storage.from(bucket).remove([attachment.staging_path]);
      return calmError("invalid_file", "That attachment does not match its selected type.", 400);
    }
    const verifiedSha256 = await sha256Hex(bytes);
    if (attachment.upload_sha256 && attachment.upload_sha256 !== verifiedSha256) {
      await admin.from("message_attachments").update({
        status: "failed", failure_code: "integrity_mismatch", verified_sha256: verifiedSha256,
        integrity_status: "mismatch",
      }).eq("id", attachment.id).eq("status", "processing");
      await admin.storage.from(bucket).remove([attachment.staging_path]);
      return calmError("integrity_mismatch", "That upload changed before it arrived. Add it again.", 400);
    }

    if (attachment.kind === "file") {
      const inspection = await inspectDocument(bytes, attachment.source_mime_type);
      if (!inspection.ok) {
        await admin.from("message_attachments").update({
          status: "failed", failure_code: inspection.code, verified_sha256: verifiedSha256,
        }).eq("id", attachment.id).eq("status", "processing");
        await admin.storage.from(bucket).remove([attachment.staging_path]);
        const copy = inspection.code === "macro_not_allowed"
          ? "Files with macros cannot be sent. Choose a macro-free copy."
          : "That file did not pass its safety check. Choose another copy.";
        return calmError(inspection.code, copy, 422);
      }
      const quarantine = await admin.from("message_attachments").update({
        status: "pending_scan", scan_status: "pending", verified_sha256: verifiedSha256,
        integrity_status: "verified",
        failure_code: null, updated_at: new Date().toISOString(),
      }).eq("id", attachment.id).eq("status", "processing").select("id");
      if (quarantine.error || quarantine.data?.length !== 1) {
        return calmError("cancelled", "That attachment was removed.", 409);
      }
      const scan = await scanDocument({
        bytes,
        mimeType: attachment.source_mime_type,
        sha256: verifiedSha256,
        scannerUrl: Deno.env.get("CHAT_ATTACHMENT_SCANNER_URL"),
        scannerToken: Deno.env.get("CHAT_ATTACHMENT_SCANNER_TOKEN"),
      });
      if (scan.verdict === "unavailable") {
        const retryStartedAt = new Date().toISOString();
        await admin.from("message_attachments").update({
          status: "pending_scan", scan_status: "unavailable", failure_code: "scan_unavailable",
          updated_at: retryStartedAt,
        }).eq("id", attachment.id).eq("status", "pending_scan");
        return calmError(
          "scan_unavailable",
          "The file safety check is taking longer. We’ll try again.",
          503,
          { "retry-after": completionLeaseRetryAfter(retryStartedAt) },
        );
      }
      if (scan.verdict === "malicious") {
        await admin.from("message_attachments").update({
          status: "failed", scan_status: "malicious", scan_provider: "http",
          scan_reference: scan.providerReference, scanned_at: new Date().toISOString(),
          failure_code: "malware_detected", updated_at: new Date().toISOString(),
        }).eq("id", attachment.id).eq("status", "pending_scan");
        await admin.storage.from(bucket).remove([attachment.staging_path]);
        return calmError("malware_detected", "That file did not pass its safety check. Choose another copy.", 422);
      }

      const extension = extensionForDocumentMime(attachment.source_mime_type);
      if (!extension) return calmError("unsupported_type", "That file type is not supported yet.", 400);
      const filePath = `${attachment.conversation_id}/${attachment.id}/file.${extension}`;
      const uploaded = await uploadOrReuseObject({
        client: admin,
        path: filePath,
        bytes,
        contentType: attachment.source_mime_type,
        isReusable: (existing) => isExactObject(existing, bytes),
      });
      if (!uploaded) {
        await admin.from("message_attachments").update({
          status: "failed", scan_status: "clean", failure_code: "processing_failed",
        }).eq("id", attachment.id).eq("status", "pending_scan");
        return calmError("processing_failed", "That file could not be prepared. Try again.", 503);
      }
      const ready = await admin.from("message_attachments").update({
        status: "ready", display_path: filePath, thumbnail_path: null,
        stored_mime_type: attachment.source_mime_type, stored_byte_size: bytes.length,
        width: null, height: null, verified_sha256: verifiedSha256,
        integrity_status: "verified",
        scan_status: "clean", scan_provider: "http", scan_reference: scan.providerReference,
        scanned_at: new Date().toISOString(), failure_code: null, updated_at: new Date().toISOString(),
      }).eq("id", attachment.id).eq("uploader_id", user.id).eq("status", "pending_scan")
        .select("*").maybeSingle();
      if (ready.error || !ready.data) {
        const recovered = await admin.from("message_attachments").select("*")
          .eq("id", attachment.id).eq("uploader_id", user.id).maybeSingle();
        const recoveredAttachment = recovered.data as AttachmentRow | null;
        if (recoveredAttachment?.status === "ready" && recoveredAttachment.display_path === filePath) {
          return Response.json({
            attachment: recoveredAttachment,
            urls: await signAttachmentPaths(caller, recoveredAttachment),
          }, { headers: jsonHeaders });
        }
        if (!recovered.error && (!recoveredAttachment || recoveredAttachment.status === "cancelled")) {
          await admin.storage.from(bucket).remove([filePath]);
          return calmError("cancelled", "That attachment was removed.", 409);
        }
        return calmError("processing", "That attachment is still being checked.", 409, {
          "retry-after": completionLeaseRetryAfter(recoveredAttachment?.updated_at),
        });
      }
      return Response.json({
        attachment: ready.data,
        urls: await signAttachmentPaths(caller, ready.data as AttachmentRow),
      }, { headers: jsonHeaders });
    }

    if (!inspectNormalizedImage(bytes).ok) {
      await admin.from("message_attachments").update({
        status: "failed", failure_code: "invalid_file", verified_sha256: verifiedSha256,
      }).eq("id", attachment.id).eq("status", "processing");
      await admin.storage.from(bucket).remove([attachment.staging_path]);
      return calmError("invalid_file", "That photo could not be prepared. Choose another copy.", 400);
    }
    const base = `${attachment.conversation_id}/${attachment.id}`;
    const displayPath = `${base}/display.webp`;
    const separateThumbnail = Math.max(attachment.width ?? 0, attachment.height ?? 0) > 64;
    let thumbnailPath = separateThumbnail ? `${base}/thumbnail.webp` : displayPath;
    try {
      let sourceWidth = attachment.width;
      let sourceHeight = attachment.height;
      let storedByteSize: number | null = null;
      if (sourceWidth && sourceHeight) {
        const displaySize = fit(sourceWidth, sourceHeight, 1920);
        const thumbnailSize = fit(sourceWidth, sourceHeight, 64);
        thumbnailPath = Math.max(sourceWidth, sourceHeight) > 64
          ? `${base}/thumbnail.webp`
          : displayPath;
        const existingDisplay = await downloadObjectBytes(admin, displayPath);
        const existingThumbnail = thumbnailPath === displayPath
          ? existingDisplay
          : await downloadObjectBytes(admin, thumbnailPath);
        if (
          existingDisplay && existingThumbnail
          && isExpectedWebp(existingDisplay, displaySize.width, displaySize.height)
          && isExpectedWebp(existingThumbnail, thumbnailSize.width, thumbnailSize.height)
        ) {
          storedByteSize = existingDisplay.length;
        } else {
          await admin.storage.from(bucket).remove([...new Set([displayPath, thumbnailPath])]);
        }
      }

      if (storedByteSize === null) {
        const display = await makeVariant(bytes, 1920, 78, 1_250_000);
        const thumbnail = Math.max(display.sourceWidth, display.sourceHeight) > 64
          ? await makeVariant(bytes, 64, 56, 16_000)
          : null;
        if (display.bytes.length > attachmentLimits.normalizedImageBytes) {
          throw new Error("processed_too_large");
        }
        sourceWidth = display.sourceWidth;
        sourceHeight = display.sourceHeight;
        thumbnailPath = thumbnail ? `${base}/thumbnail.webp` : displayPath;
        const checkpoint = await admin.from("message_attachments").update({
          width: sourceWidth,
          height: sourceHeight,
          verified_sha256: verifiedSha256,
          integrity_status: "verified",
          updated_at: new Date().toISOString(),
        }).eq("id", attachment.id).eq("status", "processing").select("id").maybeSingle();
        if (checkpoint.error || !checkpoint.data) throw new Error("cancelled");
        const displayUpload = await uploadOrReuseObject({
          client: admin,
          path: displayPath,
          bytes: display.bytes,
          contentType: "image/webp",
          isReusable: (existing) => isExactObject(existing, display.bytes),
        });
        if (!displayUpload) throw new Error("variant_upload_failed");
        if (thumbnail) {
          const thumbnailUpload = await uploadOrReuseObject({
            client: admin,
            path: thumbnailPath,
            bytes: thumbnail.bytes,
            contentType: "image/webp",
            isReusable: (existing) => isExactObject(existing, thumbnail.bytes),
          });
          if (!thumbnailUpload) throw new Error("variant_upload_failed");
        }
        storedByteSize = display.bytes.length;
      }
      if (!sourceWidth || !sourceHeight || storedByteSize === null) throw new Error("processing_failed");
      const ready = await admin.from("message_attachments").update({
        status: "ready", display_path: displayPath, thumbnail_path: thumbnailPath,
        stored_mime_type: "image/webp", stored_byte_size: storedByteSize,
        width: sourceWidth, height: sourceHeight,
        verified_sha256: verifiedSha256, integrity_status: "verified", scan_status: "not_required",
        failure_code: null, updated_at: new Date().toISOString(),
      }).eq("id", attachment.id).eq("uploader_id", user.id).eq("status", "processing")
        .select("*").maybeSingle();
      if (ready.error || !ready.data) {
        const recovered = await admin.from("message_attachments").select("*")
          .eq("id", attachment.id).eq("uploader_id", user.id).maybeSingle();
        const recoveredAttachment = recovered.data as AttachmentRow | null;
        if (recoveredAttachment?.status === "ready" && recoveredAttachment.display_path === displayPath) {
          return Response.json({
            attachment: recoveredAttachment,
            urls: await signAttachmentPaths(caller, recoveredAttachment),
          }, { headers: jsonHeaders });
        }
        if (!recovered.error && (!recoveredAttachment || recoveredAttachment.status === "cancelled")) {
          await admin.storage.from(bucket).remove([...new Set([displayPath, thumbnailPath])]);
          return calmError("cancelled", "That attachment was removed.", 409);
        }
        return calmError("processing", "That attachment is still being checked.", 409, {
          "retry-after": completionLeaseRetryAfter(recoveredAttachment?.updated_at),
        });
      }
      return Response.json({
        attachment: ready.data,
        urls: await signAttachmentPaths(caller, ready.data as AttachmentRow),
      }, { headers: jsonHeaders });
    } catch (processingError) {
      const cancelled = processingError instanceof Error && processingError.message === "cancelled";
      if (!cancelled) {
        console.error("chat attachment processing failed", { kind: attachment.kind });
        await admin.from("message_attachments").update({
          status: "failed", failure_code: "processing_failed", verified_sha256: verifiedSha256,
        }).eq("id", attachment.id).eq("status", "processing");
      } else {
        const recovered = await admin.from("message_attachments").select("status")
          .eq("id", attachment.id).maybeSingle();
        if (!recovered.error && (!recovered.data || recovered.data.status === "cancelled")) {
          await admin.storage.from(bucket).remove([...new Set([displayPath, thumbnailPath])]);
        }
      }
      return calmError(
        cancelled ? "cancelled" : "processing_failed",
        cancelled ? "That attachment was removed." : "That photo could not be prepared. Try another copy.",
        cancelled ? 409 : 422,
      );
    }
  }

  if (command.action === "cancel-upload") {
    const attachmentId = String(command.attachmentId ?? "");
    const cancelled = await admin.from("message_attachments").update({
      status: "cancelled", updated_at: new Date().toISOString(),
    }).eq("id", attachmentId).eq("uploader_id", user.id).is("message_id", null)
      .select("*").maybeSingle();
    const attachment = cancelled.data as AttachmentRow | null;
    if (!attachment) return Response.json({ cancelled: true }, { headers: jsonHeaders });
    await admin.storage.from(bucket).remove(
      [...new Set([attachment.staging_path, attachment.display_path, attachment.thumbnail_path]
        .filter((path): path is string => Boolean(path)))],
    );
    return Response.json({ cancelled: true }, { headers: jsonHeaders });
  }

  if (command.action === "refresh-image-urls" || command.action === "refresh-attachment-urls") {
    const requestedIds = Array.isArray(command.attachmentIds)
      ? command.attachmentIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const attachmentIds = [...new Set(requestedIds)].slice(0, 50);
    if (attachmentIds.length === 0 || attachmentIds.length !== requestedIds.length) {
      return calmError("invalid_request", "Those attachments are not available.", 400);
    }
    const selected = await caller.from("message_attachments")
      .select("id, thumbnail_path, display_path").in("id", attachmentIds).eq("status", "ready");
    if (selected.error || !selected.data || selected.data.length !== attachmentIds.length) {
      return calmError("not_authorized", "Those attachments are not available.", 403);
    }
    const paths = [...new Set(selected.data.flatMap((row) => [row.thumbnail_path, row.display_path])
      .filter((path): path is string => Boolean(path)))];
    const signed = await caller.storage.from(bucket).createSignedUrls(paths, signedUrlSeconds);
    if (signed.error) {
      return calmError("delivery_unavailable", "Those attachments did not load yet. Try again.", 503);
    }
    const urlByPath = new Map((signed.data ?? []).map((item) => [item.path, item.signedUrl]));
    return Response.json({
      expiresAt: new Date(Date.now() + signedUrlSeconds * 1000).toISOString(),
      urls: signed.data ?? [],
      attachments: selected.data.map((row) => ({
        attachmentId: row.id,
        thumbnailUrl: row.thumbnail_path ? urlByPath.get(row.thumbnail_path) ?? null : null,
        displayUrl: row.display_path ? urlByPath.get(row.display_path) ?? null : null,
      })),
    }, { headers: jsonHeaders });
  }

  return calmError("invalid_request", "That attachment action is not available.", 400);
});
