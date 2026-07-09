"use client";

import { useCallback, useEffect, type RefObject } from "react";

interface UseLoadOlderMessagesOptions {
  viewportRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  /** Plan 10-03's Promise-returning loadOlderMessages. */
  onLoadOlder: () => Promise<void>;
}

/** Sentinel-triggered "load earlier" with reading-position preservation
 *  (CLOAD-03/CLOAD-04). Exposes ONE wrapped `loadOlderAndPreserveScroll`
 *  callback — both the IntersectionObserver sentinel below and the
 *  component's "Load earlier" button must call this same callback, never
 *  the raw `onLoadOlder`, or the button path would bypass the scroll
 *  restore (review HIGH 10-04). */
export function useLoadOlderMessages({
  viewportRef,
  sentinelRef,
  hasMoreOlder,
  isLoadingOlder,
  onLoadOlder,
}: UseLoadOlderMessagesOptions) {
  const loadOlderAndPreserveScroll = useCallback(async (): Promise<void> => {
    const viewport = viewportRef.current;
    const previousScrollHeight = viewport?.scrollHeight ?? 0;
    const previousScrollTop = viewport?.scrollTop ?? 0;

    await onLoadOlder();

    if (!viewport) {
      return;
    }

    // Restore instantly (no animated scroll) once the prepend has painted —
    // overflow-anchor:none (globals.css) keeps the browser's own scroll
    // anchoring from fighting this manual restore. Focus is never moved.
    requestAnimationFrame(() => {
      viewport.scrollTop =
        viewport.scrollHeight - previousScrollHeight + previousScrollTop;
    });
  }, [onLoadOlder, viewportRef]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMoreOlder || isLoadingOlder) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadOlderAndPreserveScroll();
        }
      },
      { root: null, rootMargin: "200px 0px 0px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreOlder, isLoadingOlder, loadOlderAndPreserveScroll, sentinelRef]);

  return { loadOlderAndPreserveScroll };
}
