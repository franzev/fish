"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { LoadOlderMessagesOutcome } from "./use-chat-messages";

interface UseLoadOlderMessagesOptions {
  viewportRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  /** Per-conversation store state (pagination.hasLoadError), committed
   *  atomically with isLoadingOlder=false on olderPageLoadFailed. */
  hasLoadError: boolean;
  /** Reports whether the older-page request loaded, failed, or was skipped. */
  onLoadOlder: () => Promise<LoadOlderMessagesOutcome>;
}

/** Sentinel-triggered "load earlier" with reading-position preservation
 *  (CLOAD-03/CLOAD-04). Exposes ONE wrapped `loadOlderAndPreserveScroll`
 *  callback — both the IntersectionObserver sentinel below and the
 *  component's "Load earlier" button must call this same callback, never
 *  the raw `onLoadOlder`, or the button path would bypass the scroll
 *  restore (review HIGH 10-04).
 *
 *  The failure flag (`hasLoadError`) is per-conversation store state, read
 *  as a prop rather than owned locally. It commits in the SAME reducer
 *  update that clears isLoadingOlder, so there is no longer an
 *  intermediate render where loading is false but the failure hasn't
 *  landed yet — that gap previously let the observer effect below
 *  re-attach over a still-intersecting sentinel and fire a second
 *  automatic request. Because the flag is already scoped by
 *  conversationId in the store, a conversation switch shows the new
 *  conversation's own (fresh) flag for free — no callback-identity reset
 *  block is needed (see .planning/debug/older-load-double-retry.md). */
export function useLoadOlderMessages({
  viewportRef,
  sentinelRef,
  hasMoreOlder,
  isLoadingOlder,
  hasLoadError,
  onLoadOlder,
}: UseLoadOlderMessagesOptions) {
  // Generation token: onLoadOlder is recreated per conversation (its
  // useCallback identity is keyed on conversationId in use-chat-messages).
  // A completion that resolves after the identity has moved on belongs to a
  // conversation this hook no longer shows (WR-01) and must be dropped.
  // Refs cannot be written during render (react-hooks/refs), so the effect
  // below — not this render body — keeps it current; reads happen only
  // inside callbacks that run after render (async continuations, rAF).
  const latestOnLoadOlderRef = useRef(onLoadOlder);
  const pendingRafRef = useRef<number | null>(null);

  useEffect(() => {
    latestOnLoadOlderRef.current = onLoadOlder;

    return () => {
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
    };
  }, [onLoadOlder]);

  const loadOlderAndPreserveScroll = useCallback(async (): Promise<void> => {
    const requestCallback = onLoadOlder;
    const viewport = viewportRef.current;
    const previousScrollHeight = viewport?.scrollHeight ?? 0;
    const previousScrollTop = viewport?.scrollTop ?? 0;

    await onLoadOlder();

    // The conversation may have switched (a new onLoadOlder identity) while
    // this request was in flight. A stale completion must never restore
    // scroll into whatever conversation is now mounted — drop it silently.
    // (The failure flag itself is store state scoped to the conversation
    // the request was made for, so it never needs this guard.)
    if (latestOnLoadOlderRef.current !== requestCallback) {
      return;
    }

    if (viewport) {
      // Restore instantly (no animated scroll) once the prepend has painted —
      // overflow-anchor:none (globals.css) keeps the browser's own scroll
      // anchoring from fighting this manual restore. Focus is never moved.
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
      }
      pendingRafRef.current = requestAnimationFrame(() => {
        pendingRafRef.current = null;
        if (latestOnLoadOlderRef.current !== requestCallback) {
          return;
        }
        viewport.scrollTop =
          viewport.scrollHeight - previousScrollHeight + previousScrollTop;
      });
    }
  }, [onLoadOlder, viewportRef]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMoreOlder || isLoadingOlder || hasLoadError) {
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
    hasLoadError,
    hasMoreOlder,
    isLoadingOlder,
    loadOlderAndPreserveScroll,
    sentinelRef,
  ]);

  return { hasOlderLoadError: hasLoadError, loadOlderAndPreserveScroll };
}
