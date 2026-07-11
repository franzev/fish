"use client";

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
}

type InitializeResponse = Awaited<ReturnType<ReturnType<typeof getChatImageService>["initialize"]>>;

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}-${Math.random()}`;
}

function uploadWithTus(
  file: File,
  initialized: InitializeResponse,
  onProgress: (progress: number) => void,
  register: (upload: tus.Upload) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: initialized.tusEndpoint,
      retryDelays: [0, 1_000, 3_000, 5_000],
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
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
    void upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
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
      else reject(new Error("That image did not upload yet. Try again."));
    });
    request.addEventListener("error", () => {
      reject(new Error("That image did not upload yet. Try again."));
    });
    request.addEventListener("abort", () => reject(new Error("Image upload cancelled.")));
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
  const uploads = useRef(new Map<string, { abort(removeFingerprint?: boolean): Promise<void> | void }>());
  const completionQueue = useRef<Promise<void>>(Promise.resolve());
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const update = useCallback((id: string, values: Partial<PendingChatImage>) => {
    setImages((current) => current.map((image) =>
      image.clientUploadId === id ? { ...image, ...values } : image
    ));
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
    try {
      update(id, { status: "preparing", progress: 0.02, notice: undefined });
      const prepared = pending.kind === "image"
        ? await prepareChatImage(pending.file, (progress) => {
            update(id, { progress: Math.max(0.02, Math.min(0.25, progress / 400)) });
          })
        : pending.file.type === pending.sourceMimeType
          ? pending.file
          : new File([pending.file], pending.file.name, { type: pending.sourceMimeType });
      if (pending.kind === "image" && prepared.size > chatLimits.imageUploadMaxBytes) {
        throw new Error("This image stays too large after preparation. Try a smaller copy.");
      }
      const initialized = await getChatImageService().initialize({
          conversationId,
          clientUploadId: id,
          originalName: pending.file.name || "Image",
          sourceMimeType: pending.sourceMimeType,
          sourceByteSize: pending.file.size,
      });
      update(id, { attachmentId: initialized.attachmentId, status: "uploading", progress: 0.25 });
      const onUploadProgress = (progress: number) => {
        update(id, { progress: 0.25 + progress * 0.65 });
      };
      try {
        await uploadWithTus(
          prepared,
          initialized,
          onUploadProgress,
          (upload) => uploads.current.set(id, upload)
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
          (upload) => uploads.current.set(id, upload)
        );
      }
      uploads.current.delete(id);
      update(id, { progress: 0.92, status: "processing" });
      const completed = await completeAttachment(initialized.attachmentId);
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
      uploads.current.delete(id);
      update(id, {
        status: "failed",
        notice: error instanceof Error ? error.message : "That image did not upload yet. Try again.",
      });
    }
  }, [completeAttachment, conversationId, update]);

  const addFiles = useCallback((files: File[]) => {
    setNotice(null);
    if (imagesRef.current.length + files.length > chatLimits.attachmentMaxCount) {
      setNotice("Add up to five files to one message.");
      return;
    }
    const invalid = files.find((file) =>
      !allowedAttachmentTypes.has(attachmentMimeType(file)) || file.size < 1 || file.size > chatLimits.attachmentSourceMaxBytes
    );
    if (invalid) {
      setNotice(
        !allowedAttachmentTypes.has(attachmentMimeType(invalid))
          ? "That file type is not supported yet."
          : "Each file needs to be 10 MB or smaller."
      );
      return;
    }
    const pending = files.map((file): PendingChatImage => ({
      clientUploadId: requestId(),
      file,
      kind: attachmentMimeType(file).startsWith("image/") ? "image" : "file",
      sourceMimeType: attachmentMimeType(file),
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "preparing",
    }));
    setImages((current) => [...current, ...pending]);
    void (async () => {
      for (let index = 0; index < pending.length; index += 2) {
        await Promise.all(pending.slice(index, index + 2).map(runUpload));
      }
    })();
  }, [runUpload]);

  const remove = useCallback(async (clientUploadId: string) => {
    const image = imagesRef.current.find((item) => item.clientUploadId === clientUploadId);
    if (!image) return;
    const active = uploads.current.get(clientUploadId);
    if (active) {
      await Promise.resolve(active.abort(true)).catch(() => undefined);
      uploads.current.delete(clientUploadId);
    }
    URL.revokeObjectURL(image.previewUrl);
    setImages((current) => current.filter((item) => item.clientUploadId !== clientUploadId));
    if (image.attachmentId) {
      void getChatImageService().cancel(image.attachmentId);
    }
  }, []);

  const retry = useCallback((clientUploadId: string) => {
    const image = imagesRef.current.find((item) => item.clientUploadId === clientUploadId);
    if (!image) return;
    const replacement = { ...image, clientUploadId: requestId(), attachmentId: undefined };
    setImages((current) => current.map((item) => item.clientUploadId === clientUploadId ? replacement : item));
    void runUpload(replacement);
  }, [runUpload]);

  const clear = useCallback((options: { preservePreviewUrls?: boolean } = {}) => {
    if (!options.preservePreviewUrls) {
      for (const image of imagesRef.current) URL.revokeObjectURL(image.previewUrl);
    }
    setImages([]);
    setNotice(null);
  }, []);

  useEffect(() => () => {
    for (const upload of uploads.current.values()) void upload.abort(false);
    for (const image of imagesRef.current) URL.revokeObjectURL(image.previewUrl);
  }, []);

  useEffect(() => {
    if (!images.some((image) => image.status === "uploading" || image.status === "processing")) {
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
