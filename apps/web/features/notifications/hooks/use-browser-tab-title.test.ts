import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  formatBrowserTabTitle,
  useBrowserTabTitle,
} from "./use-browser-tab-title";

describe("formatBrowserTabTitle", () => {
  it.each([
    [0, "FISH"],
    [2, "(2) FISH"],
    [12, "(9+) FISH"],
  ])("formats %s unread conversations", (count, expected) => {
    expect(formatBrowserTabTitle(count)).toBe(expected);
  });
});

describe("useBrowserTabTitle", () => {
  it("restores the title when it unmounts", () => {
    document.title = "Original";
    const { rerender, unmount } = renderHook(
      ({ count }) => useBrowserTabTitle(count),
      { initialProps: { count: 2 } }
    );
    expect(document.title).toBe("(2) FISH");
    rerender({ count: 0 });
    expect(document.title).toBe("FISH");
    unmount();
    expect(document.title).toBe("Original");
  });
});
