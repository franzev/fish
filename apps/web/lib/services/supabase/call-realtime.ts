"use client";

import {
  reportFailedResult,
  reportOperationalError,
} from "@/lib/observability/reporter";
import type {
  CallRealtimeEvent,
  CallRealtimeService,
  ClientCallStatus,
} from "../contracts";
import { createBrowserSupabaseClient } from "./browser";
import { toClientCall } from "./call-mapping";
import type { CallRow } from "@fish/supabase";

const liveStatuses: ClientCallStatus[] = ["ringing", "connecting", "active"];

function isCallStatus(value: unknown): value is ClientCallStatus {
  return [
    "ringing",
    "connecting",
    "active",
    "ended",
    "rejected",
    "cancelled",
    "missed",
    "failed",
  ].includes(String(value));
}

async function withCounterpart(
  row: CallRow,
  userId: string
): Promise<{ call: ReturnType<typeof toClientCall>; counterpartName: string }> {
  const client = createBrowserSupabaseClient();
  const counterpartId = row.coach_id === userId ? row.client_id : row.coach_id;
  const { data } = await client.from("profiles").select("display_name")
    .eq("id", counterpartId).maybeSingle();
  return {
    call: toClientCall(row),
    counterpartName: data?.display_name ?? "Your call partner",
  };
}

export const supabaseCallRealtimeService: CallRealtimeService = {
  subscribe(userId, onEvent, onRecovery) {
    const client = createBrowserSupabaseClient();
    const channel = client.channel(`calls:user:${userId}`, {
      config: { private: true },
    }).on("broadcast", { event: "call.changed" }, ({ payload }) => {
      const value = payload as Partial<CallRealtimeEvent>;
      if (
        typeof value.callId === "string" &&
        typeof value.occurredAt === "string" &&
        isCallStatus(value.status)
      ) {
        onEvent({
          callId: value.callId,
          status: value.status,
          occurredAt: value.occurredAt,
        });
      }
    });
    let active = true;
    void client.realtime.setAuth().then(() => {
      if (active) {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") onRecovery?.();
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reportFailedResult({ ok: false, code: status }, {
              operation: "realtime.calls.subscribe",
              recoverable: true,
              runtime: "browser",
            });
          }
        });
      }
    }).catch((error) => {
      reportOperationalError(error, {
        operation: "realtime.calls.authenticate",
        handled: true,
        recoverable: true,
        runtime: "browser",
      });
    });
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  },

  async findCurrentCall(userId) {
    const client = createBrowserSupabaseClient();
    const { data } = await client.from("calls").select("*")
      .in("status", liveStatuses)
      .or(`coach_id.eq.${userId},client_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? withCounterpart(data, userId) : null;
  },

  async findCall(callId, userId) {
    const client = createBrowserSupabaseClient();
    const { data } = await client.from("calls").select("*")
      .eq("id", callId).maybeSingle();
    return data ? withCounterpart(data, userId) : null;
  },
};
