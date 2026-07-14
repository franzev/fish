"use client";

import type {
  NotificationRealtimeHint,
  NotificationRealtimeService,
} from "../contracts";
import { createBrowserSupabaseClient } from "./browser";

function toHint(value: Partial<NotificationRealtimeHint>): NotificationRealtimeHint | null {
  if (
    typeof value.itemId !== "string" ||
    typeof value.changeSeq !== "number" ||
    typeof value.reason !== "string" ||
    typeof value.occurredAt !== "string"
  ) {
    return null;
  }
  return {
    itemId: value.itemId,
    changeSeq: value.changeSeq,
    reason: value.reason,
    occurredAt: value.occurredAt,
  };
}

export const supabaseNotificationRealtimeService: NotificationRealtimeService = {
  subscribe(userId, onHint, onRecovery, onStatus) {
    const client = createBrowserSupabaseClient();
    const channel = client
      .channel(`notifications:user:${userId}`, { config: { private: true } })
      .on("broadcast", { event: "notifications.changed" }, ({ payload }) => {
        const hint = toHint(payload as Partial<NotificationRealtimeHint>);
        if (hint) onHint(hint);
      });
    let active = true;
    void client.realtime.setAuth().then(() => {
      if (!active) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          onStatus?.("connected");
          onRecovery?.();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          onStatus?.("disconnected");
        }
      });
    });
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  },
};
