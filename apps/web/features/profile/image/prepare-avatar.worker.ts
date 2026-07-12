/// <reference lib="webworker" />

import {
  avatarMinEdge,
  avatarPreparedMaxBytes,
  type PixelCrop,
} from "./avatar-image";

self.addEventListener("message", async (event: MessageEvent<{
  file: File;
  crop: PixelCrop;
}>) => {
  try {
    const bitmap = await createImageBitmap(event.data.file, {
      imageOrientation: "from-image",
    });
    const crop = event.data.crop;
    const outputSize = Math.max(
      avatarMinEdge,
      Math.min(1024, Math.round(Math.min(crop.width, crop.height)))
    );
    const canvas = new OffscreenCanvas(outputSize, outputSize);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(
      bitmap,
      Math.round(crop.x),
      Math.round(crop.y),
      Math.round(crop.width),
      Math.round(crop.height),
      0,
      0,
      outputSize,
      outputSize
    );
    bitmap.close();
    let blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
    for (let quality = 0.76; blob.size > avatarPreparedMaxBytes && quality >= 0.58; quality -= 0.06) {
      blob = await canvas.convertToBlob({ type: "image/webp", quality });
    }
    if (blob.size > avatarPreparedMaxBytes) {
      throw new Error("This photo stays too large after preparation. Try a simpler copy.");
    }
    self.postMessage({
      kind: "complete",
      file: new File([blob], "prepared-avatar.webp", { type: "image/webp" }),
    });
  } catch (error) {
    self.postMessage({
      kind: "error",
      message: error instanceof Error ? error.message : "We could not prepare that photo.",
    });
  }
});

export {};
