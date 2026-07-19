import { describe, expect, it } from "vitest";
import { getSendDisabledReason } from "./composer";

describe("getSendDisabledReason", () => {
  it.each([
    [{ status: "failed" as const, kind: "image" as const }, "Retry or remove the upload that didn't finish"],
    [{ status: "preparing" as const, kind: "image" as const }, "Still preparing your photo"],
    [{ status: "uploading" as const, kind: "file" as const }, "Still uploading your file"],
    [{ status: "processing" as const, kind: "image" as const }, "Still finishing your photo"],
  ])("explains %j", (image, expected) => {
    expect(getSendDisabledReason([image as never])).toBe(expected);
  });

  it("allows sending when every upload is ready", () => {
    expect(getSendDisabledReason([])).toBeNull();
  });
});
