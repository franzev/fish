import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StickerMedia } from "../sticker-media";
import { aquaticStickers } from "../sticker-picker/sticker-catalog";
import { StickerPreloader } from "./sticker-preloader";

const preloadStateKey = Symbol.for("fish.chat.sticker-preload-state");

class MockImage {
  fetchPriority = "";
  onerror: ((event: Event) => void) | null = null;
  onload: ((event: Event) => void) | null = null;
  sizes = "";
  src = "";
  srcset = "";
}

function installImageMock(): MockImage[] {
  const images: MockImage[] = [];
  class InstalledMockImage extends MockImage {
    constructor() {
      super();
      images.push(this);
    }
  }
  vi.stubGlobal("Image", InstalledMockImage);
  return images;
}

function clearPreloadState() {
  delete (globalThis as typeof globalThis & Record<symbol, unknown>)[
    preloadStateKey
  ];
}

describe("StickerPreloader", () => {
  beforeEach(() => {
    clearPreloadState();
  });

  afterEach(() => {
    cleanup();
    clearPreloadState();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders no server markup and does not start image requests during render", () => {
    const images = installImageMock();

    expect(renderToString(<StickerPreloader />)).toBe("");
    expect(images).toHaveLength(0);
    expect(
      document.head.querySelector('link[href*="/stickers/"]')
    ).toBeNull();
  });

  it("waits for page load and idle time, then preloads optimized images two at a time", () => {
    const images = installImageMock();
    let runIdleCallback: IdleRequestCallback | undefined;
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      runIdleCallback = callback;
      return 7;
    });
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");

    render(<StickerPreloader />);

    expect(images).toHaveLength(0);
    expect(requestIdleCallback).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("load"));

    expect(requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 2_000 }
    );
    expect(images).toHaveLength(0);

    act(() => {
      runIdleCallback?.({
        didTimeout: false,
        timeRemaining: () => 50,
      });
    });

    expect(images).toHaveLength(2);
    expect(images[0].fetchPriority).toBe("low");
    expect(images[1].fetchPriority).toBe("low");

    const firstSticker = aquaticStickers[0];
    render(<StickerMedia stickerId={firstSticker.id} />);
    const visibleSticker = screen.getByAltText(firstSticker.description);
    expect(images[0].src).toBe(visibleSticker.getAttribute("src"));
    expect(images[0].srcset).toBe(visibleSticker.getAttribute("srcset"));
    expect(images[0].sizes).toBe(visibleSticker.getAttribute("sizes"));

    act(() => images[0].onerror?.(new Event("error")));
    expect(images).toHaveLength(3);
    act(() => images[1].onload?.(new Event("load")));
    expect(images).toHaveLength(4);

    for (let index = 2; index < images.length; index += 1) {
      act(() => images[index].onload?.(new Event("load")));
    }

    expect(images).toHaveLength(aquaticStickers.length);
    expect(images.every((image) => image.fetchPriority === "low")).toBe(true);

    render(<StickerPreloader />);
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(images).toHaveLength(aquaticStickers.length);
  });

  it("cancels pending load and idle scheduling when unmounted", () => {
    installImageMock();
    const requestIdleCallback = vi.fn(() => 11);
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);
    const readyState = vi
      .spyOn(document, "readyState", "get")
      .mockReturnValue("loading");

    const waitingForLoad = render(<StickerPreloader />);
    waitingForLoad.unmount();
    window.dispatchEvent(new Event("load"));
    expect(requestIdleCallback).not.toHaveBeenCalled();

    readyState.mockReturnValue("complete");
    const waitingForIdle = render(<StickerPreloader />);
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    waitingForIdle.unmount();
    expect(cancelIdleCallback).toHaveBeenCalledWith(11);
  });

  it("uses a cancellable post-load timer when idle callbacks are unavailable", () => {
    vi.useFakeTimers();
    const images = installImageMock();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");

    const cancelled = render(<StickerPreloader />);
    expect(images).toHaveLength(0);
    cancelled.unmount();
    act(() => vi.runOnlyPendingTimers());
    expect(images).toHaveLength(0);

    render(<StickerPreloader />);
    act(() => vi.runOnlyPendingTimers());
    expect(images).toHaveLength(2);
  });
});
