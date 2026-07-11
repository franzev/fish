import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatImageUploads } from "./use-chat-image-uploads";

const mocks = vi.hoisted(() => ({
  compress: vi.fn(),
  initialize: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("browser-image-compression", () => ({ default: mocks.compress }));
vi.mock("@/lib/services/runtime/browser", () => ({
  getChatImageService: () => ({
    initialize: mocks.initialize,
    complete: mocks.complete,
    cancel: mocks.cancel,
    refreshUrls: vi.fn(),
  }),
}));
vi.mock("tus-js-client", () => ({
  Upload: class Upload {
    constructor(_file: File, private readonly options: {
      onProgress: (sent: number, total: number) => void;
      onSuccess: () => void;
    }) {}
    findPreviousUploads() { return Promise.resolve([]); }
    resumeFromPreviousUpload() {}
    start() {
      this.options.onProgress(1, 2);
      this.options.onProgress(2, 2);
      this.options.onSuccess();
    }
    abort() { return Promise.resolve(); }
  },
}));

describe("useChatImageUploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    mocks.compress.mockImplementation(async (file: File, options: { onProgress?: (value: number) => void }) => {
      options.onProgress?.(35);
      return new File([file], "prepared.webp", { type: "image/webp" });
    });
    mocks.initialize.mockResolvedValue({
      attachmentId: "attachment-1",
      bucket: "chat-images",
      objectPath: "conversation/attachment/staging.webp",
      uploadToken: "token",
      tusEndpoint: "https://storage.test/upload/resumable",
      signedUploadUrl: "https://storage.test/object/upload/sign/path?token=token",
    });
    mocks.complete.mockResolvedValue({
      attachment: {
        id: "attachment-1",
        status: "ready",
        originalName: "photo.png",
        width: 1200,
        height: 800,
        thumbnailPath: "conversation/attachment/thumbnail.webp",
        displayPath: "conversation/attachment/display.webp",
        thumbnailUrl: "https://storage.test/thumbnail",
        displayUrl: "https://storage.test/display",
      },
      urls: [],
    });
  });

  it("prepares locally without depending on a remote worker script", async () => {
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));
    const file = new File(["png"], "photo.png", { type: "image/png" });

    act(() => result.current.addFiles([file]));
    await waitFor(() => expect(result.current.images[0]?.status).toBe("ready"));

    expect(mocks.compress).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        useWebWorker: false,
        maxSizeMB: 2,
        maxWidthOrHeight: 2560,
        initialQuality: 0.8,
        fileType: "image/webp",
        preserveExif: false,
      })
    );

    act(() => result.current.clear({ preservePreviewUrls: true }));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("removes one image without clearing the rest of a multiple-image selection", async () => {
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.png", { type: "image/png" });

    act(() => result.current.addFiles([first, second]));
    await waitFor(() => expect(result.current.images).toHaveLength(2));
    await waitFor(() => expect(result.current.images.every((image) => image.status === "ready")).toBe(true));
    const secondId = result.current.images[1]!.clientUploadId;
    await act(async () => result.current.remove(secondId));

    expect(result.current.images).toHaveLength(1);
    expect(result.current.images[0]?.file.name).toBe("first.png");
  });

  it("serializes server processing for multiple images", async () => {
    let finishFirst: ((value: Awaited<ReturnType<typeof mocks.complete>>) => void) | undefined;
    const firstCompletion = new Promise<Awaited<ReturnType<typeof mocks.complete>>>((resolve) => {
      finishFirst = resolve;
    });
    const readyAttachment = {
      attachment: {
        id: "attachment-1",
        status: "ready" as const,
        originalName: "photo.png",
        width: 1200,
        height: 800,
        thumbnailPath: "conversation/attachment/thumbnail.webp",
        displayPath: "conversation/attachment/display.webp",
        thumbnailUrl: "https://storage.test/thumbnail",
        displayUrl: "https://storage.test/display",
      },
      urls: [],
    };
    mocks.complete.mockReset();
    mocks.complete.mockImplementationOnce(() => firstCompletion);
    mocks.complete.mockResolvedValue(readyAttachment);

    const { result } = renderHook(() => useChatImageUploads("conversation-1"));
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.png", { type: "image/png" });

    act(() => result.current.addFiles([first, second]));
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    expect(result.current.images.filter((image) => image.status === "processing")).toHaveLength(2);

    finishFirst?.(readyAttachment);
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.images.every((image) => image.status === "ready")).toBe(true));
  });
});
