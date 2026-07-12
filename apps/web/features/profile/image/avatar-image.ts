"use client";

import {
  avatarFileTypes,
  avatarMaxEdge,
  avatarMaxPixels,
  avatarMinEdge,
  avatarPreparedMaxBytes,
  avatarSourceMaxBytes,
  type PixelCrop,
} from "./avatar-image-config";

export * from "./avatar-image-config";

export interface AvatarFileValidation {
  width: number;
  height: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("We could not read that photo. Try another copy."));
    image.src = url;
  });
}

export async function validateAvatarFile(file: File): Promise<AvatarFileValidation> {
  if (!avatarFileTypes.has(file.type.toLowerCase())) {
    throw new Error("Choose a JPG, PNG, or WebP photo.");
  }
  if (file.size < 1 || file.size > avatarSourceMaxBytes) {
    throw new Error("This photo is over 10 MB. Try a smaller one.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width < avatarMinEdge || height < avatarMinEdge) {
      throw new Error("Choose a photo at least 128 pixels wide and tall.");
    }
    if (
      width > avatarMaxEdge
      || height > avatarMaxEdge
      || width * height > avatarMaxPixels
    ) {
      throw new Error("That photo is too large to prepare safely. Try a smaller copy.");
    }
    return { width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("We could not prepare that photo.")),
      "image/webp",
      quality
    );
  });
}

export async function prepareAvatarOnMainThread(
  file: File,
  crop: PixelCrop
): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const outputSize = Math.max(
      avatarMinEdge,
      Math.min(1024, Math.round(Math.min(crop.width, crop.height)))
    );
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("We could not prepare that photo.");
    context.drawImage(
      image,
      Math.round(crop.x),
      Math.round(crop.y),
      Math.round(crop.width),
      Math.round(crop.height),
      0,
      0,
      outputSize,
      outputSize
    );
    let blob = await canvasBlob(canvas, 0.82);
    for (let quality = 0.76; blob.size > avatarPreparedMaxBytes && quality >= 0.58; quality -= 0.06) {
      blob = await canvasBlob(canvas, quality);
    }
    if (blob.size > avatarPreparedMaxBytes) {
      throw new Error("This photo stays too large after preparation. Try a simpler copy.");
    }
    return new File([blob], `${crypto.randomUUID()}.webp`, { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function prepareAvatar(file: File, crop: PixelCrop): Promise<File> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return prepareAvatarOnMainThread(file, crop);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./prepare-avatar.worker.ts", import.meta.url), {
      type: "module",
    });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("Preparing this photo took too long. Try a smaller copy."));
    }, 45_000);
    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };
    worker.addEventListener("message", (event: MessageEvent<{
      kind: "complete" | "error";
      file?: File;
      message?: string;
    }>) => {
      finish();
      if (event.data.kind === "complete" && event.data.file) resolve(event.data.file);
      else reject(new Error(event.data.message || "We could not prepare that photo."));
    });
    worker.addEventListener("error", () => {
      finish();
      reject(new Error("We could not prepare that photo. Try another copy."));
    });
    worker.postMessage({ file, crop });
  });
}
