import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatestRequest } from "./use-latest-request";

describe("useLatestRequest", () => {
  it("accepts only the newest request", () => {
    const { result } = renderHook(({ conversationId }) => useLatestRequest(conversationId), {
      initialProps: { conversationId: "conversation-1" },
    });
    const first = result.current.begin();
    const second = result.current.begin();
    expect(result.current.isLatest(first)).toBe(false);
    expect(result.current.isLatest(second)).toBe(true);
  });

  it("invalidates requests when the conversation changes", () => {
    const { result, rerender } = renderHook(({ conversationId }) => useLatestRequest(conversationId), {
      initialProps: { conversationId: "conversation-1" },
    });
    const first = result.current.begin();
    rerender({ conversationId: "conversation-2" });
    expect(result.current.isLatest(first)).toBe(false);
    expect(result.current.begin().conversationId).toBe("conversation-2");
  });
});
