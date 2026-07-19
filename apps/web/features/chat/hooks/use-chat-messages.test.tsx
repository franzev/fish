import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chat } from "../components/chat-client/chat-client.fixtures";
import { chatStore, resetChatStoreForTests } from "../model/store";
import { useChatMessages } from "./use-chat-messages";

beforeEach(() => {
  resetChatStoreForTests();
});

describe("useChatMessages", () => {
  it("deduplicates refreshes while the message cooldown is active", async () => {
    const refreshMessagesAction = vi.fn(async () => ({
      status: "sent" as const,
      values: {},
      messages: [],
    }));
    const { result } = renderHook(() =>
      useChatMessages({ chat, refreshMessagesAction })
    );

    await act(async () => {
      await result.current.refreshMessages(["message-1", "message-1"]);
      await result.current.refreshMessages(["message-1"]);
    });

    expect(refreshMessagesAction).toHaveBeenCalledTimes(1);
    expect(refreshMessagesAction).toHaveBeenCalledWith({
      messageIds: ["message-1"],
    });
  });

  it("skips a second load-earlier request while the first is in flight", async () => {
    let resolveLoad!: (value: {
      status: "sent";
      values: unknown;
      messages: typeof chat.messages;
      hasMoreOlder: boolean;
    }) => void;
    const loadOlderMessagesAction = vi.fn(
      () =>
        new Promise<{
          status: "sent";
          values: unknown;
          messages: typeof chat.messages;
          hasMoreOlder: boolean;
        }>((resolve) => {
          resolveLoad = resolve;
        })
    );
    const { result } = renderHook(() =>
      useChatMessages({
        chat: { ...chat, hasMoreOlder: true },
        loadOlderMessagesAction,
      })
    );

    await waitFor(() =>
      expect(
        chatStore.getState().conversations[chat.conversationId]
      ).toBeDefined()
    );

    let firstRequest!: Promise<string>;
    await act(async () => {
      firstRequest = result.current.loadOlderMessages();
      await waitFor(() => expect(loadOlderMessagesAction).toHaveBeenCalledTimes(1));
      await expect(result.current.loadOlderMessages()).resolves.toBe("skipped");
    });

    resolveLoad({
      status: "sent",
      values: {},
      messages: [],
      hasMoreOlder: false,
    });
    await act(async () => {
      await expect(firstRequest).resolves.toBe("loaded");
    });
  });

  it("falls back to the bounded newest window when a backfill requires reset", async () => {
    const backfillMessagesAction = vi.fn(async () => ({
      status: "sent" as const,
      values: {},
      needsReset: true,
      messages: [],
    }));
    const loadNewestMessagesAction = vi.fn(async () => ({
      status: "sent" as const,
      values: {},
      messages: [],
      readStates: [],
      hasMoreOlder: false,
      oldestCursor: null,
    }));
    const { result } = renderHook(() =>
      useChatMessages({
        chat,
        backfillMessagesAction,
        loadNewestMessagesAction,
      })
    );

    await act(async () => {
      await result.current.applyGapBackfill();
    });

    expect(backfillMessagesAction).toHaveBeenCalledWith({
      conversationId: chat.conversationId,
      afterCreatedAt: chat.messages[0]?.createdAt,
      afterMessageId: chat.messages[0]?.id,
    });
    expect(loadNewestMessagesAction).toHaveBeenCalledWith({
      conversationId: chat.conversationId,
    });
  });
});
