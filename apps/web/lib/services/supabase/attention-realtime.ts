"use client";

import type { AttentionRealtimeService } from "../contracts";
import { createBrowserSupabaseClient } from "./browser";

export const supabaseAttentionRealtimeService: AttentionRealtimeService = {
  subscribe(conversationIds, onChange, onRecovery) {
    const client = createBrowserSupabaseClient();
    let active = true;
    let recovered = false;
    const channels = Array.from(new Set(conversationIds)).map((conversationId) =>
      client
        .channel(`attention:conversation:${conversationId}`, {
          config: { private: true },
        })
        .on("broadcast", { event: "attention.changed" }, () => onChange(conversationId))
    );
    void client.realtime.setAuth().then(() => {
      if (!active) return;
      if (channels.length === 0) {
        onRecovery?.();
        return;
      }
      channels.forEach((channel) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED" && !recovered) {
            recovered = true;
            onRecovery?.();
          }
        });
      });
    });
    return () => {
      active = false;
      channels.forEach((channel) => void client.removeChannel(channel));
    };
  },
};
