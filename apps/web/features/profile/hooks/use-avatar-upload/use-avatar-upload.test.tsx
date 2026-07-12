import { act, renderHook, waitFor } from "@testing-library/react";
import type { AvatarCommandService } from "@/lib/services";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prepareAvatarMock = vi.hoisted(() => vi.fn());

vi.mock("../../image/avatar-image", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../image/avatar-image")>();
  return { ...original, prepareAvatar: prepareAvatarMock };
});

import { useAvatarUpload } from "./use-avatar-upload";

class FakeXMLHttpRequest extends EventTarget {
  static instances: FakeXMLHttpRequest[] = [];

  readonly upload = new EventTarget();
  status = 0;

  constructor() {
    super();
    FakeXMLHttpRequest.instances.push(this);
  }

  open() {}
  setRequestHeader() {}

  send() {
    if (FakeXMLHttpRequest.instances.length > 1) {
      this.status = 200;
      queueMicrotask(() => this.dispatchEvent(new Event("load")));
    }
  }

  abort() {
    this.dispatchEvent(new Event("abort"));
  }
}

describe("useAvatarUpload", () => {
  const initialize = vi.fn();
  const complete = vi.fn();
  const cancel = vi.fn();
  const remove = vi.fn();
  const service = {
    initialize,
    complete,
    cancel,
    remove,
    resolveUrls: vi.fn(),
  } as unknown as AvatarCommandService;

  beforeEach(() => {
    vi.clearAllMocks();
    FakeXMLHttpRequest.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
    prepareAvatarMock.mockResolvedValue(
      new File(["prepared"], "prepared.webp", { type: "image/webp" })
    );
    initialize.mockResolvedValue({
      uploadId: "upload-1",
      bucket: "avatars",
      objectPath: "user/upload/staging.webp",
      uploadToken: "token",
      signedUploadUrl: "https://storage.test/upload",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    complete.mockResolvedValue({ profileId: "user-1", updatedAt: new Date().toISOString() });
    cancel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not retry or complete an upload after the editor unmounts", async () => {
    const { result, unmount } = renderHook(() => useAvatarUpload(service));
    const file = new File(["source"], "avatar.png", { type: "image/png" });
    let saveResult: Promise<boolean> | undefined;

    act(() => {
      saveResult = result.current.save(file, { x: 0, y: 0, width: 256, height: 256 });
    });
    await waitFor(() => expect(FakeXMLHttpRequest.instances).toHaveLength(1));

    unmount();
    await expect(saveResult).resolves.toBe(false);

    expect(FakeXMLHttpRequest.instances).toHaveLength(1);
    expect(cancel).toHaveBeenCalledWith("upload-1");
    expect(complete).not.toHaveBeenCalled();
  });
});
