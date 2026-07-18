"use client";

import { reportOperationalError } from "@/lib/observability/reporter";
import { getChatImageService } from "@/lib/services/runtime/browser";
import { chatLimits } from "@fish/core/chat";
import * as tus from "tus-js-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { prepareChatImage } from "./prepare-chat-image";

export const allowedAttachmentTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const extensionMimeTypes: Record<string, string> = {
  pdf: "application/pdf", txt: "text/plain", csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function attachmentMimeType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  return extensionMimeTypes[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
}

export type ImageUploadStatus =
  | "preparing"
  | "uploading"
  | "processing"
  | "ready"
  | "failed";

export interface PendingChatImage {
  clientUploadId: string;
  attachmentId?: string;
  file: File;
  kind: "image" | "file";
  sourceMimeType: string;
  previewUrl: string;
  progress: number;
  status: ImageUploadStatus;
  notice?: string;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  displayPath?: string;
  thumbnailUrl?: string;
  displayUrl?: string;
  storedMimeType?: string;
  storedByteSize?: number;
  uploadSha256?: string;
}

type InitializeResponse = Awaited<ReturnType<ReturnType<typeof getChatImageService>["initialize"]>>;
type UploadAuthorization = Extract<InitializeResponse, { bucket: string }>;
type UploadTransport = { abort(removeFingerprint?: boolean): Promise<void> | void };

interface UploadOperation {
  cancelled: boolean;
  waitForHashClaim: Promise<void>;
  releaseHashClaim: () => void;
  attachmentId?: string;
  transport?: UploadTransport;
}

class ControlledUploadError extends Error {}
class UploadCancelledError extends Error {}

function safeUploadNotice(error: unknown): string {
  return error instanceof ControlledUploadError
    ? error.message
    : "That attachment did not upload yet. Try again.";
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}-${Math.random()}`;
}

async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function uploadWithTus(
  file: File,
  initialized: UploadAuthorization,
  onProgress: (progress: number) => void,
  register: (upload: tus.Upload) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: initialized.tusEndpoint,
      retryDelays: [0, 1_000, 3_000, 5_000],
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      headers: { "x-signature": initialized.uploadToken },
      metadata: {
        bucketName: initialized.bucket,
        objectName: initialized.objectPath,
        contentType: initialized.uploadMimeType,
        cacheControl: "3600",
      },
      onProgress: (sent, total) => onProgress(total > 0 ? sent / total : 0),
      onError: reject,
      onSuccess: () => resolve(),
    });
    register(upload);
    upload.start();
  });
}

function uploadWithSignedPut(
  file: File,
  url: string,
  onProgress: (progress: number) => void,
  register: (upload: { abort(): Promise<void> }) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    register({
      abort: async () => request.abort(),
    });
    request.open("PUT", url);
    request.setRequestHeader("content-type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new ControlledUploadError("That attachment did not upload yet. Try again."));
    });
    request.addEventListener("error", () => {
      reject(new ControlledUploadError("That attachment did not upload yet. Try again."));
    });
    request.addEventListener("abort", () => reject(new UploadCancelledError()));
    request.send(file);
  });
}

function canUseSignedPutFallback(error: unknown): boolean {
  if (!(error instanceof tus.DetailedError)) return false;
  const status = error.originalResponse?.getStatus();
  return status === 400 || status === 403;
}

export function useChatImageUploads(conversationId: string) {
  const [images, setImages] = useState<PendingChatImage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const operations = useRef(new Map<string, UploadOperation>());
  const completionQueue = useRef<Promise<void>>(Promise.resolve());
  const hashClaimQueue = useRef<Promise<void>>(Promise.resolve());
  const claimedUploadHashes = useRef(new Map<string, string>());
  const imagesRef = useRef<PendingChatImage[]>([]);
  const mounted = useRef(true);

  const replaceImages = useCallback((transform: (current: PendingChatImage[]) => PendingChatImage[]) => {
    const next = transform(imagesRef.current);
    imagesRef.current = next;
    if (mounted.current) setImages(next);
  }, []);

  const update = useCallback((id: string, values: Partial<PendingChatImage>) => {
    replaceImages((current) => current.map((image) =>
      image.clientUploadId === id ? { ...image, ...values } : image
    ));
  }, [replaceImages]);

  const reserveOperation = useCallback((): UploadOperation => {
    const waitForHashClaim = hashClaimQueue.current;
    let releaseNextHashClaim: (() => void) | undefined;
    hashClaimQueue.current = new Promise<void>((resolve) => {
      releaseNextHashClaim = resolve;
    });
    let released = false;
    return {
      cancelled: false,
      waitForHashClaim,
      releaseHashClaim: () => {
        if (released) return;
        released = true;
        releaseNextHashClaim?.();
      },
    };
  }, []);

  const completeAttachment = useCallback((attachmentId: string) => {
    const completed = completionQueue.current.then(
      () => getChatImageService().complete(attachmentId)
    );
    completionQueue.current = completed.then(
      () => undefined,
      () => undefined
    );
    return completed;
  }, []);

  const runUpload = useCallback(async (pending: PendingChatImage) => {
    const id = pending.clientUploadId;
    const operation = operations.current.get(id) ?? reserveOperation();
    operations.current.set(id, operation);
    const assertActive = () => {
      if (operation.cancelled || !mounted.current) throw new UploadCancelledError();
    };
    try {
      assertActive();
      update(id, { status: "preparing", progress: 0.02, notice: undefined });
      const prepared = pending.kind === "image"
        ? await prepareChatImage(pending.file, (progress) => {
            if (!operation.cancelled) {
              update(id, { progress: Math.max(0.02, Math.min(0.25, progress / 400)) });
            }
          })
        : pending.file.type === pending.sourceMimeType
          ? pending.file
          : new File([pending.file], pending.file.name, { type: pending.sourceMimeType });
      assertActive();
      if (pending.kind === "image" && prepared.size > chatLimits.imageUploadMaxBytes) {
        throw new ControlledUploadError("This image stays too large after preparation. Try a smaller copy.");
      }
      const uploadSha256 = await sha256(prepared);
      await operation.waitForHashClaim;
      try {
        assertActive();
        const duplicateOwner = claimedUploadHashes.current.get(uploadSha256);
        if (duplicateOwner && duplicateOwner !== id) {
          URL.revokeObjectURL(pending.previewUrl);
          replaceImages((current) => current.filter((item) => item.clientUploadId !== id));
          setNotice("One duplicate file was skipped.");
          return;
        }
        claimedUploadHashes.current.set(uploadSha256, id);
        update(id, { uploadSha256 });
      } finally {
        operation.releaseHashClaim();
      }
      const initialized = await getChatImageService().initialize({
        conversationId,
        clientUploadId: id,
        originalName: pending.file.name || "Image",
        sourceMimeType: pending.sourceMimeType,
        sourceByteSize: pending.file.size,
        uploadSha256,
      });
      operation.attachmentId = initialized.attachmentId;
      if (operation.cancelled || !mounted.current) {
        await getChatImageService().cancel(initialized.attachmentId).catch(() => undefined);
        throw new UploadCancelledError();
      }
      update(id, { attachmentId: initialized.attachmentId, status: "uploading", progress: 0.25 });
      if ("attachment" in initialized) {
        const attachment = initialized.attachment;
        update(id, {
          status: "ready",
          progress: 1,
          width: attachment.width,
          height: attachment.height,
          thumbnailPath: attachment.thumbnailPath,
          displayPath: attachment.displayPath,
          thumbnailUrl: attachment.thumbnailUrl,
          displayUrl: attachment.displayUrl,
          storedMimeType: attachment.mimeType,
          storedByteSize: attachment.byteSize,
        });
        return;
      }
      const onUploadProgress = (progress: number) => {
        if (!operation.cancelled) update(id, { progress: 0.25 + progress * 0.65 });
      };
      try {
        await uploadWithTus(
          prepared,
          initialized,
          onUploadProgress,
          (upload) => { operation.transport = upload; }
        );
      } catch (error) {
        if (!canUseSignedPutFallback(error)) throw error;
        // Signed TUS is the primary path. A signed PUT keeps small, normalized
        // images usable when a self-hosted/local Storage version cannot verify
        // signed TUS tokens; it still provides definite byte progress.
        await uploadWithSignedPut(
          prepared,
          initialized.signedUploadUrl,
          onUploadProgress,
          (upload) => { operation.transport = upload; }
        );
      }
      operation.transport = undefined;
      assertActive();
      update(id, { progress: 0.92, status: "processing" });
      const completed = await completeAttachment(initialized.attachmentId);
      assertActive();
      const attachment = completed.attachment;
      update(id, {
        status: "ready",
        progress: 1,
        width: attachment.width,
        height: attachment.height,
        thumbnailPath: attachment.thumbnailPath,
        displayPath: attachment.displayPath,
        thumbnailUrl: attachment.thumbnailUrl,
        displayUrl: attachment.displayUrl,
        storedMimeType: attachment.mimeType,
        storedByteSize: attachment.byteSize,
      });
    } catch (error) {
      if (error instanceof UploadCancelledError || operation.cancelled) return;
      reportOperationalError(new Error("Chat attachment upload failed"), {
        operation: "chat.imageUpload",
        handled: true,
        recoverable: true,
        runtime: "browser",
      });
      update(id, {
        status: "failed",
        notice: safeUploadNotice(error),
      });
    } finally {
      operation.releaseHashClaim();
      if (operations.current.get(id) === operation) operations.current.delete(id);
    }
  }, [completeAttachment, conversationId, replaceImages, reserveOperation, update]);

  const addFiles = useCallback((files: File[]) => {
    setNotice(null);
    const remaining = Math.max(0, chatLimits.attachmentMaxCount - imagesRef.current.length);
    const accepted: File[] = [];
    let unsupported = 0;
    let oversized = 0;
    let empty = 0;
    let excess = 0;
    for (const file of files) {
      const mimeType = attachmentMimeType(file);
      const isImage = mimeType.startsWith("image/");
      const limit = isImage ? chatLimits.imageSourceMaxBytes : chatLimits.documentSourceMaxBytes;
      if (!allowedAttachmentTypes.has(mimeType)) unsupported += 1;
      else if (file.size < 1) empty += 1;
      else if (file.size > limit) oversized += 1;
      else if (accepted.length >= remaining) excess += 1;
      else accepted.push(file);
    }
    const skipped = unsupported + oversized + empty + excess;
    if (skipped > 0) {
      const files = (count: number) => count === 1 ? "file" : "files";
      const reasons = [
        unsupported > 0 ? `${unsupported} unsupported ${files(unsupported)}` : null,
        oversized > 0 ? `${oversized} ${files(oversized)} over the size limit` : null,
        empty > 0 ? `${empty} empty ${files(empty)}` : null,
        excess > 0 ? `${excess} ${files(excess)} over the five-file limit` : null,
      ].filter(Boolean).join(", ");
      setNotice(`Skipped ${reasons}.`);
    }
    if (accepted.length === 0) return;
    const pending = accepted.map((file): PendingChatImage => ({
      clientUploadId: requestId(),
      file,
      kind: attachmentMimeType(file).startsWith("image/") ? "image" : "file",
      sourceMimeType: attachmentMimeType(file),
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "preparing",
    }));
    for (const item of pending) operations.current.set(item.clientUploadId, reserveOperation());
    replaceImages((current) => [...current, ...pending]);
    void (async () => {
      for (let index = 0; index < pending.length; index += 2) {
        await Promise.all(pending.slice(index, index + 2).map(runUpload));
      }
    })();
  }, [replaceImages, reserveOperation, runUpload]);

  const remove = useCallback(async (clientUploadId: string) => {
    const image = imagesRef.current.find((item) => item.clientUploadId === clientUploadId);
    const operation = operations.current.get(clientUploadId);
    if (!image && !operation) return;
    if (operation) {
      operation.cancelled = true;
      operation.releaseHashClaim();
      await Promise.resolve(operation.transport?.abort(true)).catch(() => undefined);
    }
    if (image) {
      URL.revokeObjectURL(image.previewUrl);
      if (image.uploadSha256) claimedUploadHashes.current.delete(image.uploadSha256);
    }
    replaceImages((current) => current.filter((item) => item.clientUploadId !== clientUploadId));
    const attachmentId = operation?.attachmentId ?? image?.attachmentId;
    if (attachmentId) void getChatImageService().cancel(attachmentId);
  }, [replaceImages]);

  const retry = useCallback((clientUploadId: string) => {
    const image = imagesRef.current.find((item) => item.clientUploadId === clientUploadId);
    if (!image) return;
    if (image.uploadSha256) claimedUploadHashes.current.delete(image.uploadSha256);
    if (image.attachmentId) void getChatImageService().cancel(image.attachmentId);
    const replacement = {
      ...image,
      clientUploadId: requestId(),
      attachmentId: undefined,
      uploadSha256: undefined,
    };
    operations.current.set(replacement.clientUploadId, reserveOperation());
    replaceImages((current) => current.map((item) => item.clientUploadId === clientUploadId ? replacement : item));
    void runUpload(replacement);
  }, [replaceImages, reserveOperation, runUpload]);

  const clear = useCallback((options: { preservePreviewUrls?: boolean } = {}) => {
    if (!options.preservePreviewUrls) {
      for (const image of imagesRef.current) URL.revokeObjectURL(image.previewUrl);
    }
    for (const operation of operations.current.values()) {
      operation.cancelled = true;
      operation.releaseHashClaim();
      void operation.transport?.abort(true);
      if (operation.attachmentId) void getChatImageService().cancel(operation.attachmentId);
    }
    replaceImages(() => []);
    claimedUploadHashes.current.clear();
    setNotice(null);
  }, [replaceImages]);

  useEffect(() => {
    mounted.current = true;
    const activeOperations = operations.current;
    const activeHashClaims = claimedUploadHashes.current;
    return () => {
      mounted.current = false;
      for (const operation of activeOperations.values()) {
        operation.cancelled = true;
        operation.releaseHashClaim();
        void operation.transport?.abort(true);
        if (operation.attachmentId) void getChatImageService().cancel(operation.attachmentId);
      }
      for (const image of imagesRef.current) URL.revokeObjectURL(image.previewUrl);
      activeHashClaims.clear();
    };
  }, []);

  useEffect(() => {
    if (!images.some((image) => image.status !== "ready" && image.status !== "failed")) {
      return;
    }
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [images]);

  return {
    images,
    notice,
    addFiles,
    remove,
    retry,
    clear,
    allReady: images.length > 0 && images.every((image) => image.status === "ready"),
    hasPending: images.some((image) => image.status !== "ready"),
  };
}
