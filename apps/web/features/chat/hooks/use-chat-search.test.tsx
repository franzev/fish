import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatSearchActionState } from "@/features/chat/contracts";
import { useChatSearch } from "./use-chat-search";

describe("useChatSearch", () => {
  it("runs a search and converts returned messages to local messages", async () => {
    const searchMessagesAction = vi.fn(async () => ({
      status: "sent" as const,
      values: null,
      totalCount: 1,
      messages: [{
        id: "message-1",
        conversationId: "conversation-1",
        senderId: "member-1",
        senderRole: "client" as const,
        body: "hello",
        clientRequestId: "request-1",
        createdAt: "2026-07-14T01:00:00.000Z",
      }],
    }));
    const setRightSidebar = vi.fn();
    const { result } = renderHook(() => useChatSearch({
      conversationId: "conversation-1",
      presentation: "full",
      searchEnabled: true,
      searchMembers: [],
      searchChannels: [],
      searchMessagesAction,
      closeDetails: vi.fn(),
      setRightSidebar,
    }));

    await result.current.runSearch("hello", []);

    await waitFor(() => expect(result.current.searchResults[0]?.localStatus).toBe("sent"));
    expect(searchMessagesAction).toHaveBeenCalledTimes(1);
    expect(setRightSidebar).toHaveBeenCalledWith("search");
  });

  it("ignores a stale request after a newer search invalidates it", async () => {
    let resolveFirst: ((value: ChatSearchActionState) => void) | undefined;
    const searchMessagesAction = vi.fn(() => new Promise<ChatSearchActionState>((resolve) => {
      resolveFirst = resolve;
    }));
    const { result } = renderHook(() => useChatSearch({
      conversationId: "conversation-1",
      presentation: "embedded",
      searchEnabled: true,
      searchMembers: [],
      searchChannels: [],
      searchMessagesAction,
      closeDetails: vi.fn(),
      setRightSidebar: vi.fn(),
    }));

    const request = result.current.runSearch("old", []);
    result.current.invalidateSearch();
    resolveFirst?.({ status: "sent", values: null, totalCount: 0, messages: [] });
    await request;

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });
});
