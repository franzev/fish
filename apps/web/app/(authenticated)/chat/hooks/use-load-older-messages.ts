"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import type { LoadOlderMessagesOutcome } from "./use-chat-messages";

interface UseLoadOlderMessagesOptions {
  viewportRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  /** Reports whether the older-page request loaded, failed, or was skipped. */
  onLoadOlder: () => Promise<LoadOlderMessagesOutcome>;
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
  const [hasOlderLoadError, setHasOlderLoadError] = useState(false);
  const [previousOnLoadOlder, setPreviousOnLoadOlder] = useState(
    () => onLoadOlder
  );
  if (previousOnLoadOlder !== onLoadOlder) {
    setPreviousOnLoadOlder(() => onLoadOlder);
    setHasOlderLoadError(false);
  }

  const loadOlderAndPreserveScroll = useCallback(async (): Promise<void> => {
    const viewport = viewportRef.current;
    const previousScrollHeight = viewport?.scrollHeight ?? 0;
    const previousScrollTop = viewport?.scrollTop ?? 0;

    const outcome = await onLoadOlder();

    if (viewport) {
      // Restore instantly (no animated scroll) once the prepend has painted —
      // overflow-anchor:none (globals.css) keeps the browser's own scroll
      // anchoring from fighting this manual restore. Focus is never moved.
      requestAnimationFrame(() => {
        viewport.scrollTop =
          viewport.scrollHeight - previousScrollHeight + previousScrollTop;
      });
    }

    setHasOlderLoadError(outcome === "failed");
  }, [onLoadOlder, viewportRef]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMoreOlder || isLoadingOlder || hasOlderLoadError) {
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
  }, [
    hasMoreOlder,
    hasOlderLoadError,
    isLoadingOlder,
    loadOlderAndPreserveScroll,
    sentinelRef,
  ]);

  return { hasOlderLoadError, loadOlderAndPreserveScroll };
}
