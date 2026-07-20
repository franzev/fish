import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error("Missing local Supabase environment variables. Start, reset, and seed the local stack first.");
  process.exit(1);
}

const conversationId = "11111111-1111-4111-8111-111111111111";
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
let failures = 0;

function report(label: string, ok: boolean, detail?: string): void {
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function signIn(email: string, password = "fish-client-dev"): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl!, publishableKey!, { auth: { persistSession: false } });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return client;
}

const owner = await signIn("client1@fish.dev");
const other = await signIn("client2@fish.dev");
const ownerUser = (await owner.auth.getUser()).data.user;
if (!ownerUser) throw new Error("Seeded attachment owner is unavailable.");

const prefix = `verify-attachment-${Date.now()}`;
const createdAttachmentIds: string[] = [];
const createdMessageIds: string[] = [];
const createdStoragePaths = new Set<string>();

type UploadTokenPayload = {
  exp: number;
  iat: number;
  scope: string;
  upsert: boolean;
  url: string;
};

function decodeUploadToken(token: string): UploadTokenPayload {
  const encoded = token.split(".")[1];
  if (!encoded) throw new Error("Signed upload token is missing a payload.");
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as UploadTokenPayload;
}

function signedUploadUrl(bucket: string, path: string, token: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl!.replace(/\/$/, "")}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodedPath}?token=${encodeURIComponent(token)}`;
}

function localJwtSecret(): string {
  const status = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const value = status.match(/^JWT_SECRET=(.+)$/m)?.[1];
  if (!value) throw new Error("Local Supabase JWT secret is unavailable.");
  return value.startsWith('"') ? JSON.parse(value) as string : value;
}

function signUploadToken(payload: UploadTokenPayload, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

// A valid 2×2 JPEG fixture. Keeping the bytes inline makes the integration
// probe independent of platform image tools and exercises iOS's exact staging
// representation all the way through ImageMagick.
const tinyJpeg = Uint8Array.from(Buffer.from(
  "/9j/4AAQSkZJRgABAQAAkACQAAD/4QCARXhpZgAATU0AKgAAAAgABAEaAAUAAAABAAAAPgEbAAUAAAABAAAARgEoAAMAAAABAAIAAIdpAAQAAAABAAAATgAAAAAAAACQAAAAAQAAAJAAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAAKgAwAEAAAAAQAAAAIAAAAA/8AAEQgAAgACAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A/dR2bcfmPWm73/vGh/vt9TTaAP/Z",
  "base64",
));

// A real two-entry DEFLATE ZIP with OOXML roots. This exercises native raw
// inflation and CRC validation in the Edge runtime before scanner quarantine.
const tinyDocx = Uint8Array.from(Buffer.from(
  "UEsDBBQAAAAIABpJ8lx9j8M5SgAAAE0AAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLMJqSxILVaoyM3JK7ZVyigpKbDS1y9OzkjNTSzWyy9IzQPKpOUX5SaWALlF6foFicnZiemp+kYGBmb6yfl5Jal5JbolIDOU9O0AUEsDBBQAAAAIABpJ8lxM12HDXAAAAGkAAAARAAAAd29yZC9kb2N1bWVudC54bWxFzEEKgCAQQNGrRAdookULMe9iaiU4M+IY1u1z1/Lz4OumPLsbA9XhwUSi2jZetWYFIO4KaGXiHKjbwQVt7VlOaFx8LuyCSKQTEyzzvALaSKPRTe3sXzAa/rn5AFBLAQIeAxQAAAAIABpJ8lx9j8M5SgAAAE0AAAATAAAAAAAAAAEAAACkgQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAh4DFAAAAAgAGknyXEzXYcNcAAAAaQAAABEAAAAAAAAAAQAAAKSBewAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAACAAIAgAAAAAYBAAAAAA==",
  "base64",
));

const tinyM4a = Uint8Array.from([
  0, 0, 0, 20, ...Buffer.from("ftyp"), ...Buffer.from("M4A "), 0, 0, 0, 0,
  ...Buffer.from("M4A "),
  0, 0, 0, 11, ...Buffer.from("mdat"), 1, 2, 3,
  0, 0, 0, 12, ...Buffer.from("moov"), 0, 0, 0, 1,
]);

async function initialize(
  client: SupabaseClient,
  input: { name: string; mime: string; bytes: number; hash?: string | null; request?: string },
) {
  return client.rpc("initialize_chat_attachment_upload", {
    p_conversation_id: conversationId,
    p_client_upload_id: input.request ?? `${prefix}-${crypto.randomUUID()}`,
    p_original_name: input.name,
    p_source_mime_type: input.mime,
    p_source_byte_size: input.bytes,
    p_upload_sha256: input.hash ?? null,
  });
}

function rowOf(result: { data: unknown }): Record<string, unknown> | null {
  const value = Array.isArray(result.data) ? result.data[0] : result.data;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

try {
  const imageRequest = `${prefix}-image-boundary`;
  const image = await initialize(owner, {
    name: "DCIM/private-location/IMG_1234.HEIC",
    mime: "image/heic",
    bytes: 25 * 1024 * 1024,
    request: imageRequest,
  });
  const imageRow = rowOf(image);
  if (typeof imageRow?.id === "string") createdAttachmentIds.push(imageRow.id);
  report("25 MiB image source boundary is accepted", !image.error, image.error?.message);
  report("photo name is neutralized", imageRow?.original_name === "Photo");

  const retry = await initialize(owner, {
    name: "different-photo-name.heic",
    mime: "image/heic",
    bytes: 25 * 1024 * 1024,
    request: imageRequest,
  });
  report("idempotent image retry ignores private source name", !retry.error && rowOf(retry)?.id === imageRow?.id, retry.error?.message);

  const tooLargeImage = await initialize(owner, {
    name: "photo.jpg",
    mime: "image/jpeg",
    bytes: 25 * 1024 * 1024 + 1,
  });
  report("oversized image source is rejected", Boolean(tooLargeImage.error));

  const document = await initialize(owner, {
    name: "../private/\u202ereport.pdf",
    mime: "application/pdf",
    bytes: 10 * 1024 * 1024,
    hash: "a".repeat(64),
  });
  const documentRow = rowOf(document);
  if (typeof documentRow?.id === "string") createdAttachmentIds.push(documentRow.id);
  report("10 MiB document source boundary is accepted", !document.error, document.error?.message);
  report("document name is sanitized", documentRow?.original_name === "report.pdf");

  const voice = await initialize(owner, {
    name: "Voice message.m4a",
    mime: "audio/mp4",
    bytes: tinyM4a.length,
  });
  const voiceRow = rowOf(voice);
  if (typeof voiceRow?.id === "string") createdAttachmentIds.push(voiceRow.id);
  report("audio/mp4 voice attachment initializes as a file", !voice.error && voiceRow?.kind === "file", voice.error?.message);

  const badHash = await initialize(owner, {
    name: "report.pdf",
    mime: "application/pdf",
    bytes: 12,
    hash: "BAD",
  });
  report("malformed integrity hash is rejected", Boolean(badHash.error));

  const anonymous = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
  const anonymousInitialize = await initialize(anonymous, {
    name: "report.pdf",
    mime: "application/pdf",
    bytes: 12,
  });
  report("signed-out initialization is denied", Boolean(anonymousInitialize.error));

  if (typeof documentRow?.id === "string") {
    const otherRead = await other.from("message_attachments").select("id").eq("id", documentRow.id);
    report("another member cannot read an unbound upload", !otherRead.error && otherRead.data.length === 0, otherRead.error?.message);
  }

  const readyRows = [0, 1, 2].map((position) => {
    const id = crypto.randomUUID();
    createdAttachmentIds.push(id);
    return {
      id,
      conversation_id: conversationId,
      uploader_id: ownerUser.id,
      kind: position === 2 ? "file" : "image",
      client_upload_id: `${prefix}-ready-${position}`,
      status: "ready",
      staging_path: `${conversationId}/${id}/staging`,
      display_path: `${conversationId}/${id}/${position === 2 ? "file.pdf" : "display.webp"}`,
      thumbnail_path: position === 2 ? null : `${conversationId}/${id}/thumbnail.webp`,
      original_name: position === 2 ? "report.pdf" : "Photo",
      source_mime_type: position === 2 ? "application/pdf" : "image/jpeg",
      source_byte_size: 100,
      stored_mime_type: position === 2 ? "application/pdf" : "image/webp",
      stored_byte_size: 100,
      width: position === 2 ? null : 100,
      height: position === 2 ? null : 80,
      integrity_status: "legacy_unverified",
      scan_status: position === 2 ? "legacy_accepted" : "not_required",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    };
  });
  const insertedReady = await admin.from("message_attachments").insert(readyRows);
  if (insertedReady.error) throw insertedReady.error;

  const orderedIds = [readyRows[2]!.id, readyRows[0]!.id, readyRows[1]!.id];
  const requestId = `${prefix}-send`;
  const send = await owner.rpc("send_chat_message", {
    p_conversation_id: conversationId,
    p_body: "",
    p_client_request_id: requestId,
    p_attachment_ids: orderedIds,
  });
  const message = rowOf(send);
  if (typeof message?.id === "string") createdMessageIds.push(message.id);
  report("attachment-only message sends", !send.error && typeof message?.id === "string", send.error?.message);

  const bound = await admin.from("message_attachments").select("id, position")
    .in("id", orderedIds).order("position", { ascending: true });
  report(
    "message binding preserves caller order",
    !bound.error && JSON.stringify((bound.data ?? []).map((row) => row.id)) === JSON.stringify(orderedIds),
    bound.error?.message,
  );

  const replay = await owner.rpc("send_chat_message", {
    p_conversation_id: conversationId,
    p_body: "",
    p_client_request_id: requestId,
    p_attachment_ids: orderedIds,
  });
  report("same ordered send is idempotent", !replay.error && rowOf(replay)?.id === message?.id, replay.error?.message);

  const duplicate = await owner.rpc("send_chat_message", {
    p_conversation_id: conversationId,
    p_body: "",
    p_client_request_id: `${prefix}-duplicate`,
    p_attachment_ids: [orderedIds[0], orderedIds[0]],
  });
  report("duplicate attachment ids are rejected", Boolean(duplicate.error));

  const pendingId = crypto.randomUUID();
  const readyId = crypto.randomUUID();
  createdAttachmentIds.push(pendingId, readyId);
  const partialRows = [
    {
      id: pendingId, conversation_id: conversationId, uploader_id: ownerUser.id, kind: "image",
      client_upload_id: `${prefix}-pending`, status: "pending", staging_path: `${conversationId}/${pendingId}/staging`,
      original_name: "Photo", source_mime_type: "image/jpeg", source_byte_size: 100,
      scan_status: "not_required", integrity_status: "pending",
    },
    {
      id: readyId, conversation_id: conversationId, uploader_id: ownerUser.id, kind: "image",
      client_upload_id: `${prefix}-partial-ready`, status: "ready", staging_path: `${conversationId}/${readyId}/staging`,
      display_path: `${conversationId}/${readyId}/display.webp`, thumbnail_path: `${conversationId}/${readyId}/thumbnail.webp`,
      original_name: "Photo", source_mime_type: "image/jpeg", source_byte_size: 100,
      stored_mime_type: "image/webp", stored_byte_size: 100, width: 100, height: 80,
      scan_status: "not_required", integrity_status: "legacy_unverified",
    },
  ];
  const insertedPartial = await admin.from("message_attachments").insert(partialRows);
  if (insertedPartial.error) throw insertedPartial.error;
  const partialSend = await owner.rpc("send_chat_message", {
    p_conversation_id: conversationId,
    p_body: "",
    p_client_request_id: `${prefix}-partial`,
    p_attachment_ids: [readyId, pendingId],
  });
  report("partially invalid batch is rejected atomically", Boolean(partialSend.error));
  const partialAfter = await admin.from("message_attachments").select("id, message_id").in("id", [readyId, pendingId]);
  report("partial failure binds no attachment", !partialAfter.error && partialAfter.data.every((row) => row.message_id === null));

  const expiredId = crypto.randomUUID();
  createdAttachmentIds.push(expiredId);
  const expired = await admin.from("message_attachments").insert({
    id: expiredId,
    conversation_id: conversationId,
    uploader_id: ownerUser.id,
    kind: "file",
    client_upload_id: `${prefix}-expired`,
    status: "failed",
    staging_path: `${conversationId}/${expiredId}/staging`,
    original_name: "expired.pdf",
    source_mime_type: "application/pdf",
    source_byte_size: 12,
    scan_status: "pending",
    integrity_status: "pending",
    expires_at: new Date(Date.now() - 60_000).toISOString(),
    updated_at: new Date(Date.now() - 3_600_000).toISOString(),
  });
  if (expired.error) throw expired.error;
  const claimToken = crypto.randomUUID();
  const claimed = await admin.rpc("claim_chat_attachment_cleanup", { p_claim_token: claimToken, p_limit: 10 });
  report("expired unbound attachment is claimed once", !claimed.error && (claimed.data ?? []).some((row) => row.id === expiredId), claimed.error?.message);
  const secondClaim = await admin.rpc("claim_chat_attachment_cleanup", { p_claim_token: crypto.randomUUID(), p_limit: 10 });
  report("active cleanup claim is not duplicated", !secondClaim.error && !(secondClaim.data ?? []).some((row) => row.id === expiredId), secondClaim.error?.message);
  const finished = await admin.rpc("finish_chat_attachment_cleanup", { p_claim_token: claimToken, p_deleted_ids: [expiredId] });
  report("successful cleanup removes tracking row", !finished.error && finished.data === 1, finished.error?.message);

  const callerCleanup = await owner.rpc("claim_chat_attachment_cleanup", { p_claim_token: crypto.randomUUID(), p_limit: 1 });
  report("member cannot invoke cleanup RPC", Boolean(callerCleanup.error));

  const jpegHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", tinyJpeg))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const jpegClientUploadId = `${prefix}-ios-jpeg`;
  const jpegInitialize = await owner.functions.invoke<{
    attachmentId?: string;
    bucket?: string;
    objectPath?: string;
    uploadToken?: string;
    uploadMimeType?: string;
    expiresAt?: string;
  }>("chat-image-command", {
    body: {
      action: "initialize-upload",
      conversationId,
      clientUploadId: jpegClientUploadId,
      originalName: "Photo",
      sourceMimeType: "image/jpeg",
      sourceByteSize: tinyJpeg.length,
      uploadMimeType: "image/jpeg",
      uploadSha256: jpegHash,
    },
  });
  const jpegAttachmentId = jpegInitialize.data?.attachmentId;
  if (jpegInitialize.data?.objectPath) createdStoragePaths.add(jpegInitialize.data.objectPath);
  const jpegSignedUploadUrl = jpegInitialize.data?.bucket
    && jpegInitialize.data.objectPath
    && jpegInitialize.data.uploadToken
    ? signedUploadUrl(
      jpegInitialize.data.bucket,
      jpegInitialize.data.objectPath,
      jpegInitialize.data.uploadToken,
    )
    : null;
  if (jpegAttachmentId) createdAttachmentIds.push(jpegAttachmentId);
  report(
    "iOS JPEG initialize returns JPEG staging authorization",
    !jpegInitialize.error
      && jpegInitialize.data?.uploadMimeType === "image/jpeg"
      && Boolean(jpegSignedUploadUrl),
    jpegInitialize.error?.message,
  );
  if (jpegAttachmentId && jpegInitialize.data?.uploadToken) {
    const tokenExpiry = decodeUploadToken(jpegInitialize.data.uploadToken).exp * 1000;
    const recorded = await admin.from("message_attachments")
      .select("upload_credentials_expires_at, expires_at")
      .eq("id", jpegAttachmentId).maybeSingle();
    const recordedCredentialExpiry = Date.parse(recorded.data?.upload_credentials_expires_at ?? "");
    const attachmentExpiry = Date.parse(recorded.data?.expires_at ?? "");
    report(
      "Edge persists the actual two-hour upload credential expiry",
      !recorded.error
        && recordedCredentialExpiry >= tokenExpiry
        && recordedCredentialExpiry <= tokenExpiry + 5_000
        && Date.parse(jpegInitialize.data.expiresAt ?? "") === recordedCredentialExpiry,
      recorded.error?.message,
    );
    report(
      "attachment completion lifetime covers the issued credential",
      attachmentExpiry >= recordedCredentialExpiry,
    );
  }
  if (jpegAttachmentId && jpegSignedUploadUrl) {
    const upload = await fetch(jpegSignedUploadUrl, {
      method: "PUT",
      headers: { "content-type": "image/jpeg", "x-upsert": "false" },
      body: tinyJpeg,
    });
    report("iOS JPEG bytes upload through the signed PUT", upload.ok, `${upload.status}`);
    const completed = await owner.functions.invoke<{
      attachment?: {
        status?: string;
        stored_mime_type?: string;
        display_path?: string;
        thumbnail_path?: string;
      };
      urls?: Array<{ path?: string; signedUrl?: string }>;
    }>("chat-image-command", {
      body: { action: "complete-upload", attachmentId: jpegAttachmentId },
    });
    report(
      "iOS JPEG completes to private WebP variants",
      !completed.error
        && completed.data?.attachment?.status === "ready"
        && completed.data.attachment.stored_mime_type === "image/webp"
        && completed.data.attachment.display_path?.endsWith("/display.webp") === true
        && (completed.data.urls?.length ?? 0) >= 1,
      completed.error?.message,
    );

    const completedAttachment = completed.data?.attachment;
    if (completedAttachment?.display_path) createdStoragePaths.add(completedAttachment.display_path);
    if (completedAttachment?.thumbnail_path) createdStoragePaths.add(completedAttachment.thumbnail_path);
    if (
      completedAttachment?.status === "ready"
      && completedAttachment.display_path
      && completedAttachment.thumbnail_path
    ) {
      const replay = await fetch(jpegSignedUploadUrl, {
        method: "PUT",
        headers: { "content-type": "image/jpeg", "x-upsert": "false" },
        body: tinyJpeg,
      });
      report(
        "ready staging remains occupied against signed URL replay",
        !replay.ok,
        `${replay.status}`,
      );
      const activeLeaseStartedAt = new Date(Date.now() - 2 * 60_000);
      const madeActive = await admin.from("message_attachments").update({
        status: "processing",
        updated_at: activeLeaseStartedAt.toISOString(),
      }).eq("id", jpegAttachmentId);
      if (madeActive.error) throw madeActive.error;
      const ownerSession = (await owner.auth.getSession()).data.session;
      if (!ownerSession) throw new Error("Attachment owner session is unavailable.");
      const activeLeaseResponse = await fetch(
        `${supabaseUrl.replace(/\/$/, "")}/functions/v1/chat-image-command`,
        {
          method: "POST",
          headers: {
            apikey: publishableKey,
            authorization: `Bearer ${ownerSession.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "complete-upload", attachmentId: jpegAttachmentId }),
        },
      );
      const activeLeaseBody = await activeLeaseResponse.json() as { code?: string };
      const activeLeaseRetry = Number(activeLeaseResponse.headers.get("retry-after"));
      const expectedLeaseRetry = Math.ceil(
        (activeLeaseStartedAt.getTime() + 5 * 60_000 - Date.now()) / 1000,
      );
      report(
        "active processing lease returns its remaining Retry-After",
        activeLeaseResponse.status === 409
          && activeLeaseBody.code === "processing"
          && activeLeaseRetry >= expectedLeaseRetry - 2
          && activeLeaseRetry <= expectedLeaseRetry + 2,
        `${activeLeaseResponse.status} ${activeLeaseRetry} seconds`,
      );
      const madeStale = await admin.from("message_attachments").update({
        status: "processing",
        updated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      }).eq("id", jpegAttachmentId);
      if (madeStale.error) throw madeStale.error;
      const recovered = await owner.functions.invoke<{
        attachment?: { status?: string; display_path?: string };
      }>("chat-image-command", {
        body: { action: "complete-upload", attachmentId: jpegAttachmentId },
      });
      report(
        "stale processing lease reclaims existing final variants",
        !recovered.error
          && recovered.data?.attachment?.status === "ready"
          && recovered.data.attachment.display_path === completedAttachment.display_path,
        recovered.error?.message,
      );

      const bind = await owner.rpc("send_chat_message", {
        p_conversation_id: conversationId,
        p_body: "",
        p_client_request_id: `${prefix}-jpeg-bind`,
        p_attachment_ids: [jpegAttachmentId],
      });
      const boundMessage = rowOf(bind);
      if (typeof boundMessage?.id === "string") createdMessageIds.push(boundMessage.id);
      report("recovered attachment remains bindable", !bind.error, bind.error?.message);

      const memberStagingRead = await other.storage.from("chat-images")
        .download(jpegInitialize.data!.objectPath!);
      report(
        "conversation members cannot read bound staging objects",
        Boolean(memberStagingRead.error),
        memberStagingRead.error?.message,
      );

      const readyRetry = await owner.functions.invoke<Record<string, unknown>>(
        "chat-image-command",
        {
          body: {
            action: "initialize-upload",
            conversationId,
            clientUploadId: jpegClientUploadId,
            originalName: "Photo",
            sourceMimeType: "image/jpeg",
            sourceByteSize: tinyJpeg.length,
            uploadMimeType: "image/jpeg",
            uploadSha256: jpegHash,
          },
        },
      );
      report(
        "ready initialize retry returns no upload credentials",
        !readyRetry.error
          && readyRetry.data?.status === "ready"
          && readyRetry.data?.attachmentId === jpegAttachmentId
          && !("uploadToken" in (readyRetry.data ?? {}))
          && !("signedUploadUrl" in (readyRetry.data ?? {})),
        readyRetry.error?.message,
      );
      const stagingAfterRetry = await admin.storage.from("chat-images")
        .download(jpegInitialize.data!.objectPath!);
      report(
        "ready initialize retry keeps replay guard occupied",
        !stagingAfterRetry.error && Boolean(stagingAfterRetry.data),
        stagingAfterRetry.error?.message,
      );

      const aged = await admin.from("message_attachments").update({
        updated_at: new Date(Date.now() - 21 * 60_000).toISOString(),
      }).eq("id", jpegAttachmentId);
      if (aged.error) throw aged.error;
      const activeCredentialClaimToken = crypto.randomUUID();
      const activeCredentialClaim = await admin.rpc("claim_chat_attachment_staging_cleanup", {
        p_claim_token: activeCredentialClaimToken,
        p_limit: 10,
      });
      report(
        "ready staging cleanup waits for the actual upload credential expiry",
        !activeCredentialClaim.error
          && !(activeCredentialClaim.data ?? []).some((row) => row.id === jpegAttachmentId),
        activeCredentialClaim.error?.message,
      );
      const releasedActiveCredentialClaim = await admin.rpc("finish_chat_attachment_staging_cleanup", {
        p_claim_token: activeCredentialClaimToken,
        p_deleted_ids: [],
      });
      report(
        "blocked staging cleanup releases unrelated claims",
        !releasedActiveCredentialClaim.error && releasedActiveCredentialClaim.data === 0,
        releasedActiveCredentialClaim.error?.message,
      );
    }
  }

  // Exercise the real Storage upload-token contract without waiting two
  // hours: mint a local short-lived token with the same claims/signing key,
  // let it create staging, then prove cleanup and replay are ordered by exp.
  if (jpegInitialize.data?.uploadToken) {
    const replayGuardId = crypto.randomUUID();
    const replayGuardStagingPath = `${conversationId}/${replayGuardId}/staging`;
    const replayGuardDisplayPath = `${conversationId}/${replayGuardId}/file.txt`;
    const replayGuardBytes = new TextEncoder().encode("calm");
    const template = decodeUploadToken(jpegInitialize.data.uploadToken);
    // Resolving the CLI-owned local signing key can take several seconds on a
    // cold Docker/CLI path. Complete that work before starting the short JWT
    // clock so machine load cannot consume the token's usable window.
    const signingSecret = localJwtSecret();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 10;
    const shortToken = signUploadToken({
      ...template,
      iat: issuedAt,
      exp: expiresAt,
      upsert: false,
      url: `chat-images/${replayGuardStagingPath}`,
    }, signingSecret);
    const insertedReplayGuard = await admin.from("message_attachments").insert({
      id: replayGuardId,
      conversation_id: conversationId,
      uploader_id: ownerUser.id,
      kind: "file",
      client_upload_id: `${prefix}-expired-token-replay`,
      status: "ready",
      staging_path: replayGuardStagingPath,
      display_path: replayGuardDisplayPath,
      original_name: "calm.txt",
      source_mime_type: "text/plain",
      source_byte_size: replayGuardBytes.length,
      stored_mime_type: "text/plain",
      stored_byte_size: replayGuardBytes.length,
      scan_status: "legacy_accepted",
      integrity_status: "legacy_unverified",
      // Attachment usability and upload-credential validity are separate
      // clocks. Keeping this row otherwise usable localizes any token failure
      // to the Storage assertion instead of cascading through message bind.
      expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      upload_credentials_expires_at: new Date(expiresAt * 1000).toISOString(),
      updated_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    });
    if (insertedReplayGuard.error) throw insertedReplayGuard.error;
    createdAttachmentIds.push(replayGuardId);
    createdStoragePaths.add(replayGuardStagingPath);
    createdStoragePaths.add(replayGuardDisplayPath);
    const uploadedFinal = await admin.storage.from("chat-images").upload(
      replayGuardDisplayPath,
      replayGuardBytes,
      { contentType: "text/plain", upsert: false },
    );
    if (uploadedFinal.error) throw uploadedFinal.error;
    const shortSignedUrl = signedUploadUrl("chat-images", replayGuardStagingPath, shortToken);
    const uploadedStaging = await fetch(shortSignedUrl, {
      method: "PUT",
      headers: { "content-type": "text/plain", "x-upsert": "false" },
      body: replayGuardBytes,
    });
    report(
      "short-lived signed token creates its immutable staging guard",
      uploadedStaging.ok,
      `${uploadedStaging.status}`,
    );
    const boundReplayGuard = await owner.rpc("send_chat_message", {
      p_conversation_id: conversationId,
      p_body: "",
      p_client_request_id: `${prefix}-expired-token-bind`,
      p_attachment_ids: [replayGuardId],
    });
    const replayGuardMessage = rowOf(boundReplayGuard);
    if (typeof replayGuardMessage?.id === "string") createdMessageIds.push(replayGuardMessage.id);
    report("short-lived replay guard remains bindable", !boundReplayGuard.error, boundReplayGuard.error?.message);

    const prematureClaimToken = crypto.randomUUID();
    const prematureClaim = await admin.rpc("claim_chat_attachment_staging_cleanup", {
      p_claim_token: prematureClaimToken,
      p_limit: 20,
    });
    report(
      "staging cleanup cannot claim before the signed token expires",
      !prematureClaim.error
        && !(prematureClaim.data ?? []).some((row) => row.id === replayGuardId),
      prematureClaim.error?.message,
    );
    await admin.rpc("finish_chat_attachment_staging_cleanup", {
      p_claim_token: prematureClaimToken,
      p_deleted_ids: [],
    });

    const expiryWaitMs = Math.max(0, expiresAt * 1000 - Date.now()) + 1_100;
    await new Promise((resolve) => setTimeout(resolve, expiryWaitMs));
    const failedDeletionClaimToken = crypto.randomUUID();
    const failedDeletionClaim = await admin.rpc("claim_chat_attachment_staging_cleanup", {
      p_claim_token: failedDeletionClaimToken,
      p_limit: 20,
    });
    report(
      "expired staging is claimable without claiming its bound message",
      !failedDeletionClaim.error
        && (failedDeletionClaim.data ?? []).some((row) => row.id === replayGuardId),
      failedDeletionClaim.error?.message,
    );
    const releasedFailedDeletion = await admin.rpc("finish_chat_attachment_staging_cleanup", {
      p_claim_token: failedDeletionClaimToken,
      p_deleted_ids: [],
    });
    report(
      "failed expired-staging deletion remains retryable",
      !releasedFailedDeletion.error && releasedFailedDeletion.data === 0,
      releasedFailedDeletion.error?.message,
    );
    const successfulDeletionClaimToken = crypto.randomUUID();
    const successfulDeletionClaim = await admin.rpc("claim_chat_attachment_staging_cleanup", {
      p_claim_token: successfulDeletionClaimToken,
      p_limit: 20,
    });
    report(
      "released expired-staging cleanup is claimable again",
      !successfulDeletionClaim.error
        && (successfulDeletionClaim.data ?? []).some((row) => row.id === replayGuardId),
      successfulDeletionClaim.error?.message,
    );
    const removedReplayGuard = await admin.storage.from("chat-images").remove([replayGuardStagingPath]);
    if (removedReplayGuard.error) throw removedReplayGuard.error;
    const finishedReplayGuard = await admin.rpc("finish_chat_attachment_staging_cleanup", {
      p_claim_token: successfulDeletionClaimToken,
      p_deleted_ids: [replayGuardId],
    });
    report(
      "successful expired-staging cleanup marks the ready row",
      !finishedReplayGuard.error && finishedReplayGuard.data === 1,
      finishedReplayGuard.error?.message,
    );
    const expiredReplay = await fetch(shortSignedUrl, {
      method: "PUT",
      headers: { "content-type": "text/plain", "x-upsert": "false" },
      body: replayGuardBytes,
    });
    const stagingAfterExpiredReplay = await admin.storage.from("chat-images").download(replayGuardStagingPath);
    const replayGuardAfterCleanup = await admin.from("message_attachments")
      .select("id, message_id, status, display_path, staging_cleaned_at")
      .eq("id", replayGuardId).maybeSingle();
    const finalAfterCleanup = await admin.storage.from("chat-images").download(replayGuardDisplayPath);
    report(
      "expired x-upsert:false replay cannot recreate a permanent staging object",
      !expiredReplay.ok && Boolean(stagingAfterExpiredReplay.error),
      `${expiredReplay.status}`,
    );
    report(
      "staging cleanup preserves the bound message, row, and final object",
      !replayGuardAfterCleanup.error
        && replayGuardAfterCleanup.data?.status === "ready"
        && replayGuardAfterCleanup.data.message_id === replayGuardMessage?.id
        && Boolean(replayGuardAfterCleanup.data.staging_cleaned_at)
        && replayGuardAfterCleanup.data.display_path === replayGuardDisplayPath
        && !finalAfterCleanup.error && Boolean(finalAfterCleanup.data),
      replayGuardAfterCleanup.error?.message,
    );
  }

  const docxHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", tinyDocx))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const docxInitialize = await owner.functions.invoke<{
    attachmentId?: string;
    bucket?: string;
    objectPath?: string;
    uploadToken?: string;
  }>("chat-image-command", {
    body: {
      action: "initialize-upload",
      conversationId,
      clientUploadId: `${prefix}-real-docx`,
      originalName: "verification.docx",
      sourceMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceByteSize: tinyDocx.length,
      uploadSha256: docxHash,
    },
  });
  const docxAttachmentId = docxInitialize.data?.attachmentId;
  const docxPath = docxInitialize.data?.objectPath;
  const docxUploadUrl = docxInitialize.data?.bucket && docxPath && docxInitialize.data.uploadToken
    ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/upload/sign/${encodeURIComponent(docxInitialize.data.bucket)}/${docxPath.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(docxInitialize.data.uploadToken)}`
    : null;
  if (docxAttachmentId) createdAttachmentIds.push(docxAttachmentId);
  if (docxPath) createdStoragePaths.add(docxPath);
  report(
    "real deflated OOXML receives staging authorization",
    !docxInitialize.error && Boolean(docxAttachmentId) && Boolean(docxUploadUrl),
    docxInitialize.error?.message,
  );
  if (docxAttachmentId && docxUploadUrl) {
    const docxUpload = await fetch(docxUploadUrl, {
      method: "PUT",
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "x-upsert": "false",
      },
      body: tinyDocx,
    });
    if (!docxUpload.ok) throw new Error(`OOXML fixture upload failed with ${docxUpload.status}.`);
    const ownerSession = (await owner.auth.getSession()).data.session;
    if (!ownerSession) throw new Error("Attachment owner session is unavailable.");
    const docxComplete = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/chat-image-command`,
      {
        method: "POST",
        headers: {
          apikey: publishableKey,
          authorization: `Bearer ${ownerSession.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "complete-upload", attachmentId: docxAttachmentId }),
      },
    );
    const docxCompleteBody = await docxComplete.json() as { code?: string };
    report(
      "Edge runtime inflates and CRC-checks real OOXML before quarantine",
      docxComplete.status === 503 && docxCompleteBody.code === "scan_unavailable",
      `${docxComplete.status} ${docxCompleteBody.code ?? "missing"}`,
    );
    const unavailableRetryAfter = Number(docxComplete.headers.get("retry-after"));
    report(
      "scanner-unavailable response directs retry after the completion lease",
      unavailableRetryAfter >= 295 && unavailableRetryAfter <= 300,
      `${unavailableRetryAfter} seconds`,
    );
    const pendingScanComplete = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/chat-image-command`,
      {
        method: "POST",
        headers: {
          apikey: publishableKey,
          authorization: `Bearer ${ownerSession.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "complete-upload", attachmentId: docxAttachmentId }),
      },
    );
    const pendingScanBody = await pendingScanComplete.json() as { code?: string };
    const pendingScanRetryAfter = Number(pendingScanComplete.headers.get("retry-after"));
    report(
      "active pending-scan lease returns its remaining Retry-After",
      pendingScanComplete.status === 409
        && pendingScanBody.code === "processing"
        && pendingScanRetryAfter >= 295
        && pendingScanRetryAfter <= 300,
      `${pendingScanComplete.status} ${pendingScanRetryAfter} seconds`,
    );
  }

  const edgeInitialize = await owner.functions.invoke<{
    attachmentId?: string;
    bucket?: string;
    objectPath?: string;
    uploadToken?: string;
  }>("chat-image-command", {
    body: {
      action: "initialize-upload",
      conversationId,
      clientUploadId: `${prefix}-edge-cancel`,
      originalName: "photo.jpg",
      sourceMimeType: "image/jpeg",
      sourceByteSize: 100,
    },
  });
  report("Edge initialize returns signed upload authorization", !edgeInitialize.error && Boolean(edgeInitialize.data?.attachmentId), edgeInitialize.error?.message);
  if (edgeInitialize.data?.attachmentId) {
    createdAttachmentIds.push(edgeInitialize.data.attachmentId);
    if (edgeInitialize.data.objectPath) createdStoragePaths.add(edgeInitialize.data.objectPath);
    const cancelled = await owner.functions.invoke("chat-image-command", {
      body: { action: "cancel-upload", attachmentId: edgeInitialize.data.attachmentId },
    });
    report("upload owner can cancel idempotently", !cancelled.error, cancelled.error?.message);
    const otherCancel = await other.functions.invoke("chat-image-command", {
      body: { action: "cancel-upload", attachmentId: edgeInitialize.data.attachmentId },
    });
    report("non-owner cancel reveals no attachment", !otherCancel.error, otherCancel.error?.message);
    if (
      edgeInitialize.data.bucket
      && edgeInitialize.data.objectPath
      && edgeInitialize.data.uploadToken
    ) {
      const replayAfterCancel = await fetch(signedUploadUrl(
        edgeInitialize.data.bucket,
        edgeInitialize.data.objectPath,
        edgeInitialize.data.uploadToken,
      ), {
        method: "PUT",
        headers: { "content-type": "image/jpeg", "x-upsert": "false" },
        body: tinyJpeg,
      });
      report(
        "active signed token replay after cancel remains tracked",
        replayAfterCancel.ok,
        `${replayAfterCancel.status}`,
      );
      const agedCancelled = await admin.from("message_attachments").update({
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: new Date(Date.now() - 60 * 60_000).toISOString(),
      }).eq("id", edgeInitialize.data.attachmentId);
      if (agedCancelled.error) throw agedCancelled.error;
      const activeFullCleanupToken = crypto.randomUUID();
      const activeFullCleanup = await admin.rpc("claim_chat_attachment_cleanup", {
        p_claim_token: activeFullCleanupToken,
        p_limit: 20,
      });
      report(
        "unbound full-row cleanup waits for active upload credentials",
        !activeFullCleanup.error
          && !(activeFullCleanup.data ?? []).some((row) => row.id === edgeInitialize.data!.attachmentId),
        activeFullCleanup.error?.message,
      );
      await admin.rpc("finish_chat_attachment_cleanup", {
        p_claim_token: activeFullCleanupToken,
        p_deleted_ids: [],
      });
      const trackedReplay = await admin.from("message_attachments").select("id")
        .eq("id", edgeInitialize.data.attachmentId).maybeSingle();
      const replayObject = await admin.storage.from("chat-images").download(edgeInitialize.data.objectPath);
      report(
        "active replay cannot become an untracked permanent object",
        !trackedReplay.error && Boolean(trackedReplay.data) && !replayObject.error,
        trackedReplay.error?.message ?? replayObject.error?.message,
      );
    }
  }

  const reissueClientUploadId = `${prefix}-credential-reissue`;
  const reissueBody = {
    action: "initialize-upload",
    conversationId,
    clientUploadId: reissueClientUploadId,
    originalName: "Photo",
    sourceMimeType: "image/jpeg",
    sourceByteSize: tinyJpeg.length,
    uploadMimeType: "image/jpeg",
    uploadSha256: jpegHash,
  };
  const firstIssue = await owner.functions.invoke<{
    attachmentId?: string;
    objectPath?: string;
    uploadToken?: string;
  }>("chat-image-command", { body: reissueBody });
  if (firstIssue.data?.attachmentId) createdAttachmentIds.push(firstIssue.data.attachmentId);
  if (firstIssue.data?.objectPath) createdStoragePaths.add(firstIssue.data.objectPath);
  if (!firstIssue.data?.attachmentId || !firstIssue.data.uploadToken) {
    report("pending upload receives a reissuable credential", false, firstIssue.error?.message);
  } else {
    const nearExpiry = new Date(Date.now() + 2_000).toISOString();
    const madeNearExpiry = await admin.from("message_attachments").update({
      upload_credentials_expires_at: nearExpiry,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    }).eq("id", firstIssue.data.attachmentId);
    if (madeNearExpiry.error) throw madeNearExpiry.error;
    const secondIssue = await owner.functions.invoke<{
      attachmentId?: string;
      uploadToken?: string;
      expiresAt?: string;
    }>("chat-image-command", { body: reissueBody });
    const secondTokenExpiry = secondIssue.data?.uploadToken
      ? decodeUploadToken(secondIssue.data.uploadToken).exp * 1000
      : Number.NaN;
    const reissuedRow = await admin.from("message_attachments")
      .select("upload_credentials_expires_at, expires_at")
      .eq("id", firstIssue.data.attachmentId).maybeSingle();
    const recordedReissueExpiry = Date.parse(reissuedRow.data?.upload_credentials_expires_at ?? "");
    report(
      "near-expiry initialize retry reissues on the same attachment",
      !secondIssue.error
        && secondIssue.data?.attachmentId === firstIssue.data.attachmentId
        && Boolean(secondIssue.data.uploadToken),
      secondIssue.error?.message,
    );
    report(
      "credential reissue atomically extends cleanup and completion lifetimes",
      !reissuedRow.error
        && recordedReissueExpiry >= secondTokenExpiry
        && Date.parse(reissuedRow.data?.expires_at ?? "") >= recordedReissueExpiry
        && Date.parse(secondIssue.data?.expiresAt ?? "") === recordedReissueExpiry
        && recordedReissueExpiry > Date.parse(nearExpiry) + 60 * 60_000,
      reissuedRow.error?.message,
    );
  }

  const rateClient = await signIn("member4@fish.dev");
  const rateUser = (await rateClient.auth.getUser()).data.user;
  const rateSession = (await rateClient.auth.getSession()).data.session;
  if (!rateUser || !rateSession) throw new Error("Seeded rate-limit member is unavailable.");
  const recent = await admin.from("message_attachments").select("id", { count: "exact", head: true })
    .eq("uploader_id", rateUser.id)
    .gt("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
  if (recent.error) throw recent.error;
  const remaining = Math.max(0, 20 - (recent.count ?? 0));
  const rateResponses = await Promise.all(
    Array.from({ length: remaining + 1 }, async (_, index) => {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/chat-image-command`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          authorization: `Bearer ${rateSession.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "initialize-upload",
          conversationId,
          clientUploadId: `${prefix}-rate-${index}`,
          originalName: "photo.jpg",
          sourceMimeType: "image/jpeg",
          sourceByteSize: 100,
        }),
      });
      const body = await response.json() as { attachmentId?: string; code?: string };
      if (body.attachmentId) createdAttachmentIds.push(body.attachmentId);
      return { response, body };
    }),
  );
  const accepted = rateResponses.filter(({ response }) => response.ok);
  const limited = rateResponses.filter(({ response, body }) =>
    response.status === 429 && body.code === "rate_limited_short"
  );
  report(
    "parallel initialization cannot overshoot the uploader rate limit",
    accepted.length === remaining && limited.length === 1,
    `${accepted.length} accepted, ${limited.length} limited`,
  );
  report(
    "short rate limit response includes an accurate Retry-After",
    Number(limited[0]?.response.headers.get("retry-after")) >= 1
      && Number(limited[0]?.response.headers.get("retry-after")) <= 600,
  );

  const dailyClient = await signIn("member3@fish.dev");
  const dailyUser = (await dailyClient.auth.getUser()).data.user;
  const dailySession = (await dailyClient.auth.getSession()).data.session;
  if (!dailyUser || !dailySession) throw new Error("Seeded daily-limit member is unavailable.");
  const dailyCreatedAt = new Date(Date.now() - 11 * 60_000);
  const dailyRows = Array.from({ length: 100 }, (_, index) => {
    const id = crypto.randomUUID();
    createdAttachmentIds.push(id);
    return {
      id,
      conversation_id: conversationId,
      uploader_id: dailyUser.id,
      kind: "image",
      client_upload_id: `${prefix}-daily-${index}`,
      status: "pending",
      staging_path: `${conversationId}/${id}/staging`,
      original_name: "Photo",
      source_mime_type: "image/jpeg",
      source_byte_size: 100,
      scan_status: "not_required",
      integrity_status: "pending",
      created_at: dailyCreatedAt.toISOString(),
    };
  });
  const insertedDailyRows = await admin.from("message_attachments").insert(dailyRows);
  if (insertedDailyRows.error) throw insertedDailyRows.error;
  const dailyResponse = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/chat-image-command`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${dailySession.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "initialize-upload",
        conversationId,
        clientUploadId: `${prefix}-daily-blocked`,
        originalName: "photo.jpg",
        sourceMimeType: "image/jpeg",
        sourceByteSize: 100,
      }),
    },
  );
  const dailyBody = await dailyResponse.json() as { code?: string };
  const dailyRetryAfter = Number(dailyResponse.headers.get("retry-after"));
  const expectedDailyRetry = Math.ceil(
    (dailyCreatedAt.getTime() + 24 * 60 * 60_000 - Date.now()) / 1000,
  );
  report(
    "daily rate limit has a distinct stable error code",
    dailyResponse.status === 429 && dailyBody.code === "rate_limited_daily",
    `${dailyResponse.status} ${dailyBody.code ?? "missing"}`,
  );
  report(
    "daily rate limit Retry-After matches the oldest daily upload",
    dailyRetryAfter >= expectedDailyRetry - 2 && dailyRetryAfter <= expectedDailyRetry + 2,
    `${dailyRetryAfter} seconds`,
  );
} finally {
  if (createdAttachmentIds.length > 0) {
    const paths = await admin.from("message_attachments")
      .select("staging_path, display_path, thumbnail_path").in("id", createdAttachmentIds);
    for (const path of (paths.data ?? []).flatMap((row) => [
      row.staging_path,
      row.display_path,
      row.thumbnail_path,
    ]).filter((path): path is string => Boolean(path))) createdStoragePaths.add(path);
    if (paths.error) report("verifier can enumerate storage cleanup paths", false, paths.error.message);
  }
  if (createdStoragePaths.size > 0) {
    const removed = await admin.storage.from("chat-images").remove([...createdStoragePaths]);
    report("verifier removes every created storage object", !removed.error, removed.error?.message);
  }
  if (createdMessageIds.length > 0) await admin.from("messages").delete().in("id", createdMessageIds);
  if (createdAttachmentIds.length > 0) await admin.from("message_attachments").delete().in("id", createdAttachmentIds);
}

if (failures > 0) {
  console.error(`${failures} attachment verification check(s) failed.`);
  process.exit(1);
}
console.log("Chat attachment verification passed.");
