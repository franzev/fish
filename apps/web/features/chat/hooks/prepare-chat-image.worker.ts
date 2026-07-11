/// <reference lib="webworker" />

import imageCompression from "browser-image-compression";
import { chatImageCompressionOptions } from "./chat-image-compression-options";

self.addEventListener("message", async (event: MessageEvent<{ file: File }>) => {
  try {
    const prepared = await imageCompression(
      event.data.file,
      chatImageCompressionOptions((progress) => {
        self.postMessage({ kind: "progress", progress });
      })
    );
    self.postMessage({
      kind: "complete",
      file: new File([prepared], "prepared.webp", { type: "image/webp" }),
    });
  } catch (error) {
    self.postMessage({
      kind: "error",
      message: error instanceof Error ? error.message : "That image could not be prepared.",
    });
  }
});

export {};
