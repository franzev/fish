import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyedSubscription } from "./use-keyed-subscription";

describe("useKeyedSubscription", () => {
  it("debounces invalidations and cleans up the active subscription", () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    let schedule: (() => void) | undefined;
    const onInvalidate = vi.fn();
    const { unmount } = renderHook(() => useKeyedSubscription({
      key: "conversation-1|conversation-2",
      subscribe: (nextSchedule) => {
        schedule = nextSchedule;
        return unsubscribe;
      },
      onInvalidate,
      delayMs: 150,
    }));

    act(() => {
      schedule?.();
      vi.advanceTimersByTime(100);
      schedule?.();
      vi.advanceTimersByTime(149);
    });
    expect(onInvalidate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onInvalidate).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
