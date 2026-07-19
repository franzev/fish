import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useIdlePreload } from "./use-idle-preload";

describe("useIdlePreload", () => {
  it("defers desktop preload until the browser is idle", () => {
    vi.useFakeTimers();
    const preload = vi.fn();
    const requestIdleCallback = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(min-width: 48rem)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    renderHook(() => useIdlePreload({
      enabled: true,
      invalidateKey: 1,
      onPreload: preload,
    }));
    expect(requestIdleCallback).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2_000));
    expect(requestIdleCallback).toHaveBeenCalled();
    expect(preload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not reschedule when only the callback identity changes", () => {
    vi.useFakeTimers();
    const firstPreload = vi.fn();
    const secondPreload = vi.fn();
    const requestIdleCallback = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(min-width: 48rem)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    const { rerender } = renderHook(
      ({ onPreload }) => useIdlePreload({
        enabled: true,
        invalidateKey: 1,
        onPreload,
      }),
      { initialProps: { onPreload: firstPreload } }
    );
    act(() => vi.advanceTimersByTime(2_000));
    act(() => rerender({ onPreload: secondPreload }));

    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(firstPreload).toHaveBeenCalledTimes(1);
    expect(secondPreload).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("cancels a pending preload when the user starts interacting", () => {
    vi.useFakeTimers();
    const preload = vi.fn();
    const requestIdleCallback = vi.fn();
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(min-width: 48rem)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    renderHook(() => useIdlePreload({
      enabled: true,
      invalidateKey: 1,
      onPreload: preload,
    }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
    act(() => vi.advanceTimersByTime(2_000));

    expect(requestIdleCallback).not.toHaveBeenCalled();
    expect(preload).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
