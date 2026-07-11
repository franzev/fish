import imageCompression from "browser-image-compression";
import { chatImageCompressionOptions } from "./chat-image-compression-options";

const preparationTimeoutMs = 45_000;

async function prepareOnMainThread(
  file: File,
  onProgress: (progress: number) => void
): Promise<File> {
  const prepared = await imageCompression(
    file,
    chatImageCompressionOptions(onProgress)
  );
  return new File([prepared], `${crypto.randomUUID()}.webp`, {
    type: "image/webp",
  });
}

export function prepareChatImage(
  file: File,
  onProgress: (progress: number) => void
): Promise<File> {
  if (typeof Worker === "undefined") {
    return prepareOnMainThread(file, onProgress);
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./prepare-chat-image.worker.ts", import.meta.url),
      { type: "module" }
    );
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("Preparing this image took too long. Try a smaller copy."));
    }, preparationTimeoutMs);

    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };
    worker.addEventListener("message", (event: MessageEvent<{
      kind: "progress" | "complete" | "error";
      progress?: number;
      file?: File;
      message?: string;
    }>) => {
      if (event.data.kind === "progress") {
        onProgress(event.data.progress ?? 0);
        return;
      }
      finish();
      if (event.data.kind === "complete" && event.data.file) {
        resolve(event.data.file);
      } else {
        reject(new Error(event.data.message || "That image could not be prepared."));
      }
    });
    worker.addEventListener("error", () => {
      finish();
      reject(new Error("That image could not be prepared. Try another copy."));
    });
    worker.postMessage({ file });
  });
}
