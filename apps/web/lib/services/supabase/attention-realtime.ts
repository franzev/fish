"use client";

import {
  reportFailedResult,
  reportOperationalError,
} from "@/lib/observability/reporter";
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
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reportFailedResult({ ok: false, code: status }, {
              operation: "realtime.attention.subscribe",
              recoverable: true,
              runtime: "browser",
            });
          }
        });
      });
    }).catch((error) => {
      reportOperationalError(error, {
        operation: "realtime.attention.authenticate",
        handled: true,
        recoverable: true,
        runtime: "browser",
      });
    });
    return () => {
      active = false;
      channels.forEach((channel) => void client.removeChannel(channel));
    };
  },
};
