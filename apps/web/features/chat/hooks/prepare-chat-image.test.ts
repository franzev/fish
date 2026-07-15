import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareChatImage } from "./prepare-chat-image";

const mocks = vi.hoisted(() => ({
  compress: vi.fn(),
}));

vi.mock("browser-image-compression", () => ({ default: mocks.compress }));

class FailingImageWorker extends EventTarget {
  postMessage(): void {
    queueMicrotask(() => {
      this.dispatchEvent(new MessageEvent("message", {
        data: {
          kind: "error",
          message: "The worker could not decode this photo.",
        },
      }));
    });
  }

  terminate(): void {}
}

describe("prepareChatImage", () => {
  const originalWorker = globalThis.Worker;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.compress.mockImplementation(async (file: File) =>
      new File([file], "prepared.webp", { type: "image/webp" })
    );
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: originalWorker,
    });
  });

  it("falls back to main-thread preparation when the image worker fails", async () => {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: FailingImageWorker,
    });
    const file = new File(["photo"], "cats.jpg", { type: "image/jpeg" });

    const prepared = await prepareChatImage(file, vi.fn());

    expect(mocks.compress).toHaveBeenCalledOnce();
    expect(prepared.type).toBe("image/webp");
  });
});
