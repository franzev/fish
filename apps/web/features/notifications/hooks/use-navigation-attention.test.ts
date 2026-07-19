import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  AttentionRealtimeService,
  NavigationAttentionRepository,
} from "@/lib/services";
import { useNavigationAttention } from "./use-navigation-attention";

const firstAttention = {
  surface: "channel" as const,
  entityId: "channel-1",
  conversationId: "conversation-1",
  unreadCount: 2,
  mentionCount: 0,
  newActivity: true,
};

describe("useNavigationAttention", () => {
  it("loads attention and refreshes through one keyed, debounced subscription", async () => {
    let schedule: (() => void) | undefined;
    const repository: NavigationAttentionRepository = {
      list: vi.fn()
        .mockResolvedValueOnce({ ok: true, data: [firstAttention] })
        .mockResolvedValueOnce({ ok: true, data: [] }),
    };
    const realtime: AttentionRealtimeService = {
      subscribe: vi.fn((_ids, next) => {
        schedule = next;
        return vi.fn();
      }),
    };
    const { result } = renderHook(() => useNavigationAttention({
      initialAttention: [],
      repository,
      realtime,
    }));

    expect(result.current.unreadConversationCount).toBe(0);
    await act(async () => {
      await result.current.refreshAttention();
    });
    await waitFor(() => expect(result.current.unreadConversationCount).toBe(1));
    expect(realtime.subscribe).toHaveBeenLastCalledWith(
      ["conversation-1"],
      expect.any(Function),
      expect.any(Function)
    );

    act(() => schedule?.());
    await waitFor(() => expect(result.current.unreadConversationCount).toBe(0));
  });

  it("does not recreate a subscription when refreshed attention keeps the same key", async () => {
    const repository: NavigationAttentionRepository = {
      list: vi.fn().mockResolvedValue({ ok: true, data: [firstAttention] }),
    };
    const realtime: AttentionRealtimeService = {
      subscribe: vi.fn(() => vi.fn()),
    };
    const { result } = renderHook(() => useNavigationAttention({
      initialAttention: [firstAttention],
      repository,
      realtime,
    }));

    await act(async () => {
      await result.current.refreshAttention();
    });

    expect(realtime.subscribe).toHaveBeenCalledTimes(1);
  });
});
