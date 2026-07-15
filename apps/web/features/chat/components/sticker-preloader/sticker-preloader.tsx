"use client";

import { getImageProps } from "next/image";
import { useEffect } from "react";
import { aquaticStickers } from "../sticker-picker/sticker-catalog";

const preloadConcurrency = 2;
const stickerSize = 96;
const stickerSizes = "96px";
const preloadStateKey = Symbol.for("fish.chat.sticker-preload-state");

interface StickerPreloadState {
  activeImages: Set<HTMLImageElement>;
  started: boolean;
}

type StickerPreloadGlobal = typeof globalThis & {
  [preloadStateKey]?: StickerPreloadState;
};

function getPreloadState(): StickerPreloadState {
  const preloadGlobal = globalThis as StickerPreloadGlobal;
  preloadGlobal[preloadStateKey] ??= {
    activeImages: new Set(),
    started: false,
  };
  return preloadGlobal[preloadStateKey];
}

function hasStartedPreloading(): boolean {
  const preloadGlobal = globalThis as StickerPreloadGlobal;
  return preloadGlobal[preloadStateKey]?.started ?? false;
}

function preloadStickers(): void {
  const state = getPreloadState();
  if (state.started) return;
  state.started = true;

  let nextStickerIndex = 0;

  const fillQueue = () => {
    while (
      state.activeImages.size < preloadConcurrency
      && nextStickerIndex < aquaticStickers.length
    ) {
      const sticker = aquaticStickers[nextStickerIndex];
      nextStickerIndex += 1;

      const {
        props: { sizes, src, srcSet },
      } = getImageProps({
        src: sticker.src,
        alt: sticker.description,
        width: stickerSize,
        height: stickerSize,
        sizes: stickerSizes,
      });
      const image = new window.Image();
      state.activeImages.add(image);

      const finish = () => {
        image.onload = null;
        image.onerror = null;
        state.activeImages.delete(image);
        fillQueue();
      };

      image.onload = finish;
      image.onerror = finish;
      image.fetchPriority = "low";
      if (sizes) image.sizes = sizes;
      if (srcSet) image.srcset = srcSet;
      image.src = src;
    }
  };

  fillQueue();
}

/** Warms the bundled sticker cache after the chat page has fully loaded. */
export function StickerPreloader() {
  useEffect(() => {
    if (hasStartedPreloading()) return;

    let idleCallbackId: number | undefined;
    let timeoutId: number | undefined;

    const schedulePreload = () => {
      if (hasStartedPreloading()) return;

      const requestIdleCallback = Reflect.get(window, "requestIdleCallback") as
        | Window["requestIdleCallback"]
        | undefined;
      if (requestIdleCallback) {
        idleCallbackId = requestIdleCallback.call(window, preloadStickers, {
          timeout: 2_000,
        });
        return;
      }

      timeoutId = window.setTimeout(preloadStickers, 0);
    };

    if (document.readyState === "complete") {
      schedulePreload();
    } else {
      window.addEventListener("load", schedulePreload, { once: true });
    }

    return () => {
      window.removeEventListener("load", schedulePreload);
      const cancelIdleCallback = Reflect.get(window, "cancelIdleCallback") as
        | Window["cancelIdleCallback"]
        | undefined;
      if (idleCallbackId !== undefined && cancelIdleCallback) {
        cancelIdleCallback.call(window, idleCallbackId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
