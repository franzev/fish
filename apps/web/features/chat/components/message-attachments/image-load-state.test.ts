import { describe, expect, it } from "vitest";
import { deriveImageLoadState } from "./image-load-state";

describe("deriveImageLoadState", () => {
  it.each([
    [{ refreshing: true, url: "url" }, "loading"],
    [{ refreshing: false, url: undefined, urlRefreshFailed: false }, "loading"],
    [{ refreshing: false, url: undefined, urlRefreshFailed: true }, "failed"],
    [{ refreshing: false, url: "url", failedUrl: "url" }, "failed"],
    [{ refreshing: false, url: "url", loadedUrl: "url" }, "loaded"],
  ] as const)("derives %s", (input, expected) => {
    expect(deriveImageLoadState(input)).toBe(expected);
  });
});
