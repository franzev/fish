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

  let worker: Worker;
  try {
    worker = new Worker(
      new URL("./prepare-chat-image.worker.ts", import.meta.url),
      { type: "module" }
    );
  } catch {
    return prepareOnMainThread(file, onProgress);
  }

  return new Promise((resolve, reject) => {
    let finished = false;
    const timeout = window.setTimeout(() => {
      fallbackToMainThread();
    }, preparationTimeoutMs);

    const finishWorker = () => {
      if (finished) return false;
      finished = true;
      window.clearTimeout(timeout);
      worker.terminate();
      return true;
    };

    function fallbackToMainThread() {
      if (!finishWorker()) return;
      void prepareOnMainThread(file, onProgress).then(resolve, reject);
    };

    worker.addEventListener("message", (event: MessageEvent<{
      kind: "progress" | "complete" | "error";
      progress?: number;
      file?: File;
      message?: string;
    }>) => {
      if (finished) return;
      if (event.data.kind === "progress") {
        onProgress(event.data.progress ?? 0);
        return;
      }
      if (event.data.kind === "complete" && event.data.file) {
        finishWorker();
        resolve(event.data.file);
      } else {
        fallbackToMainThread();
      }
    });
    worker.addEventListener("error", () => {
      fallbackToMainThread();
    });
    try {
      worker.postMessage({ file });
    } catch {
      fallbackToMainThread();
    }
  });
}
