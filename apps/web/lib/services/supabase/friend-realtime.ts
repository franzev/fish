"use client";

import type { FriendRealtimeEvent, FriendRealtimeService } from "../contracts";
import { createBrowserSupabaseClient } from "./browser";

export const supabaseFriendRealtimeService: FriendRealtimeService = {
  subscribe(userId, onEvent, onRecovery) {
    const client = createBrowserSupabaseClient();
    const channel = client.channel(`friends:user:${userId}`, {
      config: { private: true },
    }).on("broadcast", { event: "friends.changed" }, ({ payload }) => {
      const value = payload as Partial<FriendRealtimeEvent>;
      if (
        typeof value.reason === "string" &&
        typeof value.occurredAt === "string"
      ) {
        onEvent({
          ...(typeof value.requestId === "string"
            ? { requestId: value.requestId }
            : {}),
          ...(typeof value.friendshipId === "string"
            ? { friendshipId: value.friendshipId }
            : {}),
          reason: value.reason,
          occurredAt: value.occurredAt,
        });
      }
    });
    let active = true;
    void client.realtime.setAuth().then(() => {
      if (active) {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") onRecovery?.();
        });
      }
    });
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  },
};
