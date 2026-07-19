import { useEffect, useRef } from "react";

interface IdlePreloadOptions {
  enabled: boolean;
  invalidateKey: string | number;
  onPreload(): void;
  mediaQuery?: string;
}

const idlePreloadDelayMs = 2_000;

export function useIdlePreload({
  enabled,
  invalidateKey,
  onPreload,
  mediaQuery = "(min-width: 48rem)",
}: IdlePreloadOptions): void {
  const onPreloadRef = useRef(onPreload);

  useEffect(() => {
    onPreloadRef.current = onPreload;
  }, [onPreload]);

  useEffect(() => {
    if (!enabled) return;
    let idleCallbackId: number | undefined;
    let timeoutId: number | undefined;
    let delayId: number | undefined;
    let scheduled = false;
    const desktopQuery = window.matchMedia(mediaQuery);

    const preload = () => {
      scheduled = false;
      onPreloadRef.current();
    };
    const schedulePreload = () => {
      if (!desktopQuery.matches || scheduled) return;
      scheduled = true;
      const requestIdleCallback = Reflect.get(window, "requestIdleCallback") as
        | Window["requestIdleCallback"]
        | undefined;
      if (requestIdleCallback) {
        idleCallbackId = requestIdleCallback.call(window, preload, { timeout: 2_000 });
      } else {
        timeoutId = window.setTimeout(preload, 0);
      }
    };
    const cancelPreload = () => {
      const cancelIdleCallback = Reflect.get(window, "cancelIdleCallback") as
        | Window["cancelIdleCallback"]
        | undefined;
      if (idleCallbackId !== undefined && cancelIdleCallback) {
        cancelIdleCallback.call(window, idleCallbackId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (delayId !== undefined) window.clearTimeout(delayId);
      idleCallbackId = undefined;
      timeoutId = undefined;
      delayId = undefined;
      scheduled = false;
    };
    const cancelForInteraction = () => cancelPreload();
    const handleLayoutChange = () => {
      if (desktopQuery.matches) scheduleDelayedPreload();
      else cancelPreload();
    };

    function scheduleDelayedPreload() {
      if (!desktopQuery.matches || delayId !== undefined || scheduled) return;
      delayId = window.setTimeout(() => {
        delayId = undefined;
        schedulePreload();
      }, idlePreloadDelayMs);
    }

    if (document.readyState === "complete") {
      scheduleDelayedPreload();
    } else {
      window.addEventListener("load", scheduleDelayedPreload, { once: true });
    }
    desktopQuery.addEventListener("change", handleLayoutChange);
    window.addEventListener("pointerdown", cancelForInteraction, true);
    window.addEventListener("keydown", cancelForInteraction, true);
    return () => {
      window.removeEventListener("load", scheduleDelayedPreload);
      desktopQuery.removeEventListener("change", handleLayoutChange);
      window.removeEventListener("pointerdown", cancelForInteraction, true);
      window.removeEventListener("keydown", cancelForInteraction, true);
      cancelPreload();
    };
  }, [enabled, invalidateKey, mediaQuery]);
}
