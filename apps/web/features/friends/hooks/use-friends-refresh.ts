"use client";

import { getFriendRealtimeService } from "@/lib/services/runtime/browser";
import type { FriendRealtimeService } from "@/lib/services";
import { useEffect, useMemo, useRef } from "react";

/* Broadcasts are wake-up hints only: every signal (event, resubscribe after a
   reconnect, tab becoming visible again) triggers the same bounded refetch of
   RLS-protected state, so out-of-order or missed events can never corrupt
   what the user sees. */
export function useFriendsRefresh(
  userId: string,
  refresh: () => void | Promise<void>,
  realtimeOverride?: FriendRealtimeService
) {
  const realtime = useMemo(
    () => getFriendRealtimeService(realtimeOverride),
    [realtimeOverride]
  );
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let active = true;
    let running = false;
    let queued = false;

    async function requestRefresh() {
      if (!active) return;
      if (running) {
        queued = true;
        return;
      }

      running = true;
      try {
        do {
          queued = false;
          try {
            await refreshRef.current();
          } catch {
            // Realtime is a recovery hint. A later signal or visibility
            // change retries without surfacing a technical error here.
          }
        } while (active && queued);
      } finally {
        running = false;
      }
    }

    const unsubscribe = realtime.subscribe(
      userId,
      () => void requestRefresh(),
      () => void requestRefresh()
    );
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void requestRefresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unsubscribe();
    };
  }, [realtime, userId]);
}
