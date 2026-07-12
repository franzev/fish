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
  refresh: () => void,
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
    const unsubscribe = realtime.subscribe(
      userId,
      () => refreshRef.current(),
      () => refreshRef.current()
    );
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshRef.current();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unsubscribe();
    };
  }, [realtime, userId]);
}
