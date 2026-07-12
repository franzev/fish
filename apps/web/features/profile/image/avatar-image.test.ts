import { afterEach, describe, expect, it, vi } from "vitest";
import {
  avatarSourceMaxBytes,
  validateAvatarFile,
} from "./avatar-image";

describe("validateAvatarFile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects unsupported and oversized sources before decoding", async () => {
    await expect(validateAvatarFile(
      new File(["gif"], "avatar.gif", { type: "image/gif" })
    )).rejects.toThrow("Choose a JPG, PNG, or WebP photo.");

    const oversized = new File(
      [new Uint8Array(avatarSourceMaxBytes + 1)],
      "avatar.jpg",
      { type: "image/jpeg" }
    );
    await expect(validateAvatarFile(oversized)).rejects.toThrow("over 10 MB");
  });

  it("accepts a safely-sized decodable raster", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:avatar");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    class FakeImage {
      naturalWidth = 640;
      naturalHeight = 480;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", FakeImage);

    await expect(validateAvatarFile(
      new File(["jpg"], "avatar.jpg", { type: "image/jpeg" })
    )).resolves.toEqual({ width: 640, height: 480 });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar");
  });
});
