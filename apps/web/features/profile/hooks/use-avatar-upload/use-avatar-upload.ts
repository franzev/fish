"use client";

import { getAvatarCommandService } from "@/lib/services/runtime/browser";
import type { AvatarCommandService, AvatarUploadAuthorization } from "@/lib/services";
import { useCallback, useEffect, useRef, useState } from "react";
import { prepareAvatar, type PixelCrop } from "../../image/avatar-image";

export type AvatarUploadStatus =
  | "idle"
  | "selected"
  | "preparing"
  | "authorizing"
  | "uploading"
  | "processing"
  | "failed";

class UploadResponseError extends Error {
  constructor(readonly status: number) {
    super("That photo did not upload. Your crop is still here. Try again.");
  }
}

class AvatarUploadCancelledError extends Error {
  constructor() {
    super("Photo upload cancelled.");
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function uploadPreparedFile(
  file: File,
  authorization: AvatarUploadAuthorization,
  onProgress: (progress: number) => void,
  register: (request: XMLHttpRequest | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    register(request);
    request.open("PUT", authorization.signedUploadUrl);
    request.setRequestHeader("content-type", "image/webp");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    request.addEventListener("load", () => {
      register(null);
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new UploadResponseError(request.status));
    });
    request.addEventListener("error", () => {
      register(null);
      reject(new UploadResponseError(0));
    });
    request.addEventListener("abort", () => {
      register(null);
      reject(new AvatarUploadCancelledError());
    });
    request.send(file);
  });
}

export function useAvatarUpload(override?: AvatarCommandService) {
  const service = override ?? getAvatarCommandService();
  const [status, setStatus] = useState<AvatarUploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const requestRef = useRef<XMLHttpRequest | null>(null);
  const uploadIdRef = useRef<string | null>(null);
  const operationRef = useRef(0);

  useEffect(() => () => {
    operationRef.current += 1;
    requestRef.current?.abort();
    const uploadId = uploadIdRef.current;
    uploadIdRef.current = null;
    if (uploadId) void service.cancel(uploadId).catch(() => undefined);
  }, [service]);

  const markSelected = useCallback(() => {
    setStatus("selected");
    setProgress(0);
    setNotice(null);
  }, []);

  const save = useCallback(async (file: File, crop: PixelCrop) => {
    const operationId = ++operationRef.current;
    const isActive = () => operationRef.current === operationId;
    const requireActive = () => {
      if (!isActive()) throw new AvatarUploadCancelledError();
    };
    const clientUploadId = crypto.randomUUID();
    let authorization: AvatarUploadAuthorization | null = null;
    try {
      setNotice(null);
      setStatus("preparing");
      setProgress(0.08);
      const prepared = await prepareAvatar(file, crop);
      requireActive();
      setStatus("authorizing");
      setProgress(0.22);
      authorization = await service.initialize({
        clientUploadId,
        originalName: file.name || "photo.webp",
        sourceMimeType: file.type.toLowerCase(),
        sourceByteSize: file.size,
      });
      if (!isActive()) {
        await service.cancel(authorization.uploadId).catch(() => undefined);
        throw new AvatarUploadCancelledError();
      }
      uploadIdRef.current = authorization.uploadId;

      let uploaded = false;
      const retryDelays = [0, 1_000, 3_000];
      for (let attempt = 0; attempt < retryDelays.length && !uploaded; attempt += 1) {
        if (retryDelays[attempt]) await wait(retryDelays[attempt]!);
        requireActive();
        setStatus("uploading");
        try {
          await uploadPreparedFile(
            prepared,
            authorization,
            (value) => {
              if (isActive()) setProgress(0.25 + value * 0.6);
            },
            (request) => {
              if (isActive()) requestRef.current = request;
              else request?.abort();
            }
          );
          requireActive();
          uploaded = true;
        } catch (error) {
          if (error instanceof AvatarUploadCancelledError) throw error;
          if (
            error instanceof UploadResponseError
            && (error.status === 401 || error.status === 403)
            && attempt === 0
          ) {
            authorization = await service.initialize({
              clientUploadId,
              originalName: file.name || "photo.webp",
              sourceMimeType: file.type.toLowerCase(),
              sourceByteSize: file.size,
            });
            requireActive();
            continue;
          }
          if (attempt === retryDelays.length - 1) throw error;
        }
      }
      if (!uploaded) throw new Error("That photo did not upload. Your crop is still here. Try again.");

      setStatus("processing");
      setProgress(0.9);
      const processingDelays = [0, 1_000, 2_000, 4_000];
      let completed = false;
      for (let attempt = 0; attempt < processingDelays.length && !completed; attempt += 1) {
        if (processingDelays[attempt]) await wait(processingDelays[attempt]!);
        requireActive();
        try {
          await service.complete(authorization.uploadId);
          requireActive();
          completed = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (!message.toLowerCase().includes("still being prepared") || attempt === processingDelays.length - 1) {
            throw error;
          }
        }
      }
      if (!completed) throw new Error("That photo is still being prepared. Try again.");
      uploadIdRef.current = null;
      setProgress(1);
      return true;
    } catch (error) {
      if (error instanceof AvatarUploadCancelledError || !isActive()) return false;
      setStatus("failed");
      setNotice(
        error instanceof Error
          ? error.message
          : "That photo did not upload. Your crop is still here. Try again."
      );
      return false;
    }
  }, [service]);

  const remove = useCallback(async () => {
    const operationId = ++operationRef.current;
    try {
      setNotice(null);
      setStatus("processing");
      setProgress(0.5);
      await service.remove();
      if (operationRef.current !== operationId) return false;
      setProgress(1);
      setStatus("idle");
      return true;
    } catch (error) {
      if (operationRef.current !== operationId) return false;
      setStatus("failed");
      setNotice(error instanceof Error ? error.message : "That photo could not be removed yet. Try again.");
      return false;
    }
  }, [service]);

  const cancel = useCallback(async () => {
    operationRef.current += 1;
    requestRef.current?.abort();
    const uploadId = uploadIdRef.current;
    uploadIdRef.current = null;
    if (uploadId) await service.cancel(uploadId).catch(() => undefined);
    setStatus("idle");
    setProgress(0);
    setNotice(null);
  }, [service]);

  return {
    status,
    progress,
    notice,
    busy: ["preparing", "authorizing", "uploading", "processing"].includes(status),
    markSelected,
    save,
    remove,
    cancel,
  };
}
