import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatImageUploads } from "./use-chat-image-uploads";

const mocks = vi.hoisted(() => ({
  compress: vi.fn(),
  initialize: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  tusOptions: [] as Array<Record<string, unknown>>,
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
    }) { mocks.tusOptions.push(options); }
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
    mocks.tusOptions.length = 0;
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
      uploadMimeType: "image/webp",
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

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(mocks.initialize).toHaveBeenCalledWith(expect.objectContaining({
      originalName: "photo.png",
      uploadSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(mocks.tusOptions[0]).toEqual(expect.objectContaining({
      storeFingerprintForResuming: false,
    }));

    act(() => result.current.clear({ preservePreviewUrls: true }));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("continues uploading after React StrictMode replays mount effects", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { result } = renderHook(
      () => useChatImageUploads("conversation-1"),
      { wrapper }
    );

    act(() => result.current.addFiles([
      new File(["report"], "report.pdf", { type: "application/pdf" }),
    ]));

    await waitFor(() => expect(result.current.images[0]?.status).toBe("ready"));
    expect(mocks.initialize).toHaveBeenCalledTimes(1);
  });

  it("keeps valid files in picker order when other selections are rejected", async () => {
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));
    const first = new File(["first"], "first.png", { type: "image/png" });
    const unsupported = new File(["nope"], "script.exe", { type: "application/x-msdownload" });
    const second = new File(["second"], "second.pdf", { type: "application/pdf" });

    act(() => result.current.addFiles([first, unsupported, second]));

    await waitFor(() => expect(result.current.images.every((item) => item.status === "ready")).toBe(true));
    expect(result.current.images.map((item) => item.file.name)).toEqual(["first.png", "second.pdf"]);
    expect(result.current.notice).toBe("Skipped 1 unsupported file.");
  });

  it("skips an exact-byte duplicate without uploading it twice", async () => {
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));
    const first = new File(["same bytes"], "first.pdf", { type: "application/pdf" });
    const duplicate = new File(["same bytes"], "copy.pdf", { type: "application/pdf" });

    act(() => result.current.addFiles([first, duplicate]));

    await waitFor(() => expect(result.current.images).toHaveLength(1));
    await waitFor(() => expect(result.current.images[0]?.status).toBe("ready"));
    expect(result.current.images[0]?.file.name).toBe("first.pdf");
    expect(result.current.notice).toBe("One duplicate file was skipped.");
    expect(mocks.initialize).toHaveBeenCalledTimes(1);
  });

  it("keeps the first selected duplicate when its hash finishes last", async () => {
    let finishFirstHash: ((digest: ArrayBuffer) => void) | undefined;
    const delayedFirstHash = new Promise<ArrayBuffer>((resolve) => {
      finishFirstHash = resolve;
    });
    const sharedDigest = new Uint8Array(32).buffer;
    const digest = vi.spyOn(crypto.subtle, "digest")
      .mockImplementationOnce(() => delayedFirstHash)
      .mockResolvedValueOnce(sharedDigest);
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));

    act(() => result.current.addFiles([
      new File(["same bytes"], "first.pdf", { type: "application/pdf" }),
      new File(["same bytes"], "copy.pdf", { type: "application/pdf" }),
    ]));

    await waitFor(() => expect(digest).toHaveBeenCalledTimes(2));
    expect(mocks.initialize).not.toHaveBeenCalled();
    await act(async () => finishFirstHash?.(sharedDigest));

    await waitFor(() => expect(result.current.images).toHaveLength(1));
    await waitFor(() => expect(result.current.images[0]?.status).toBe("ready"));
    expect(result.current.images[0]?.file.name).toBe("first.pdf");
    expect(mocks.initialize).toHaveBeenCalledTimes(1);
  });

  it("releases a cancelled hash claim so the next duplicate can continue", async () => {
    let finishFirstHash: ((digest: ArrayBuffer) => void) | undefined;
    const delayedFirstHash = new Promise<ArrayBuffer>((resolve) => {
      finishFirstHash = resolve;
    });
    const sharedDigest = new Uint8Array(32).buffer;
    const digest = vi.spyOn(crypto.subtle, "digest")
      .mockImplementationOnce(() => delayedFirstHash)
      .mockResolvedValueOnce(sharedDigest);
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));

    act(() => result.current.addFiles([
      new File(["same bytes"], "first.pdf", { type: "application/pdf" }),
      new File(["same bytes"], "copy.pdf", { type: "application/pdf" }),
    ]));
    await waitFor(() => expect(digest).toHaveBeenCalledTimes(2));
    const firstId = result.current.images[0]!.clientUploadId;
    await act(async () => result.current.remove(firstId));

    await waitFor(() => expect(result.current.images).toHaveLength(1));
    await waitFor(() => expect(result.current.images[0]?.status).toBe("ready"));
    expect(result.current.images[0]?.file.name).toBe("copy.pdf");
    expect(mocks.initialize).toHaveBeenCalledTimes(1);
    await act(async () => finishFirstHash?.(sharedDigest));
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

  it("reserves the five attachment slots across back-to-back selections", async () => {
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));
    const files = Array.from({ length: 6 }, (_, index) =>
      new File([`file-${index}`], `file-${index}.pdf`, { type: "application/pdf" })
    );

    act(() => {
      result.current.addFiles(files.slice(0, 3));
      result.current.addFiles(files.slice(3));
    });

    expect(result.current.images).toHaveLength(5);
    expect(result.current.notice).toBe("Skipped 1 file over the five-file limit.");
    await waitFor(() => expect(result.current.images.every((item) => item.status === "ready")).toBe(true));
  });

  it("does not initialize an item removed while local preparation is pending", async () => {
    let finishPreparation: ((file: File) => void) | undefined;
    mocks.compress.mockImplementationOnce(() => new Promise<File>((resolve) => {
      finishPreparation = resolve;
    }));
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));

    act(() => result.current.addFiles([
      new File(["photo"], "photo.png", { type: "image/png" }),
    ]));
    const id = result.current.images[0]!.clientUploadId;
    await act(async () => result.current.remove(id));
    await act(async () => finishPreparation?.(
      new File(["photo"], "prepared.webp", { type: "image/webp" })
    ));

    await waitFor(() => expect(result.current.images).toHaveLength(0));
    expect(mocks.initialize).not.toHaveBeenCalled();
  });

  it("cancels the server row when removal wins an initialization race", async () => {
    let finishInitialization: ((value: Record<string, unknown>) => void) | undefined;
    mocks.initialize.mockImplementationOnce(() => new Promise((resolve) => {
      finishInitialization = resolve;
    }));
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));

    act(() => result.current.addFiles([
      new File(["report"], "report.pdf", { type: "application/pdf" }),
    ]));
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledTimes(1));
    const id = result.current.images[0]!.clientUploadId;
    await act(async () => result.current.remove(id));
    await act(async () => finishInitialization?.({
      attachmentId: "late-attachment",
      bucket: "chat-images",
      objectPath: "conversation/late/staging.pdf",
      uploadToken: "token",
      uploadMimeType: "application/pdf",
      tusEndpoint: "https://storage.test/upload/resumable",
      signedUploadUrl: "https://storage.test/signed",
    }));

    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith("late-attachment"));
    expect(result.current.images).toHaveLength(0);
  });

  it("reconciles a ready initialize response without uploading again", async () => {
    mocks.initialize.mockResolvedValueOnce({
      status: "ready",
      attachmentId: "attachment-1",
      attachment: {
        id: "attachment-1",
        status: "ready",
        kind: "file",
        originalName: "report.pdf",
        mimeType: "application/pdf",
        byteSize: 6,
        displayPath: "conversation/attachment/file.pdf",
        displayUrl: "https://storage.test/file",
      },
      urls: [],
    });
    const { result } = renderHook(() => useChatImageUploads("conversation-1"));

    act(() => result.current.addFiles([
      new File(["report"], "report.pdf", { type: "application/pdf" }),
    ]));

    await waitFor(() => expect(result.current.images[0]?.status).toBe("ready"));
    expect(result.current.images[0]?.displayUrl).toBe("https://storage.test/file");
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.tusOptions).toHaveLength(0);
  });
});
