"use client";

import {
  reportFailedResult,
  reportOperationalError,
} from "@/lib/observability/reporter";
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_IDLE_MS,
  type EffectivePresenceStatus,
} from "@fish/core/presence";
import type {
  PresencePreference,
  PresencePreferenceSetting,
  PresenceRealtimeService,
  PresenceSnapshot,
} from "../contracts";
import { createBrowserSupabaseClient } from "./browser";

const statuses = new Set<EffectivePresenceStatus>([
  "online",
  "idle",
  "away",
  "busy",
  "offline",
]);
const preferences = new Set<PresencePreference>([
  "automatic",
  "away",
  "busy",
  "invisible",
]);

function readSnapshot(value: unknown): PresenceSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const userId = row.userId ?? row.user_id;
  const status = row.status;
  const revision = row.revision;
  const updatedAt = row.updatedAt ?? row.updated_at;
  if (
    typeof userId !== "string" ||
    typeof status !== "string" ||
    !statuses.has(status as EffectivePresenceStatus) ||
    typeof revision !== "number" ||
    typeof updatedAt !== "string"
  ) return null;
  const heartbeat = row.lastHeartbeatAt ?? row.last_heartbeat_at;
  const seen = row.lastSeenAt ?? row.last_seen_at;
  return {
    userId,
    status: status as EffectivePresenceStatus,
    lastHeartbeatAt: typeof heartbeat === "string" ? heartbeat : null,
    lastSeenAt: typeof seen === "string" ? seen : null,
    revision,
    updatedAt,
  };
}

function makeSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `presence-${Date.now()}`;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export const supabasePresenceRealtimeService: PresenceRealtimeService = {
  subscribe(userId, subjectIds, onSnapshot, onPreference, onRecovery, onStatus) {
    const client = createBrowserSupabaseClient();
    const connectedChannels = new Set<string>();
    let expectedChannelCount = 0;
    let fullyConnected = false;
    let active = true;

    function markConnected(topic: string) {
      connectedChannels.add(topic);
      if (!fullyConnected && connectedChannels.size === expectedChannelCount) {
        fullyConnected = true;
        onStatus?.("connected");
        onRecovery?.();
      }
    }

    function markDisconnected(topic: string) {
      connectedChannels.delete(topic);
      fullyConnected = false;
      onStatus?.("disconnected");
    }

    const preferenceChannel = client
      .channel(`presence:user:${userId}`, { config: { private: true } })
      .on("broadcast", { event: "presence.preference.changed" }, ({ payload }) => {
        const value = payload as {
          mode?: unknown;
          expiresAt?: unknown;
          revision?: unknown;
        };
        if (
          typeof value.mode === "string" &&
          preferences.has(value.mode as PresencePreference) &&
          (
            value.expiresAt === undefined ||
            value.expiresAt === null ||
            typeof value.expiresAt === "string"
          ) &&
          typeof value.revision === "number"
        ) {
          const setting: PresencePreferenceSetting = {
            preference: value.mode as PresencePreference,
            expiresAt: typeof value.expiresAt === "string"
              ? value.expiresAt
              : null,
          };
          onPreference(setting, value.revision);
        }
      })
      .on("broadcast", { event: "presence.subjects.changed" }, () => {
        onRecovery?.();
      });
    const subscriptionId = makeSessionId();
    const snapshotChannels = chunks(
      Array.from(new Set([userId, ...subjectIds])),
      100
    ).map((ids, index) => {
      const channel = client.channel(
        `presence:snapshots:${userId}:${subscriptionId}:${index}`,
        { config: { broadcast: { replication_ready: true } } }
      );
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "presence_snapshots",
            filter: `user_id=in.(${ids.join(",")})`,
          },
          ({ new: value }) => {
            const snapshot = readSnapshot(value);
            if (snapshot) onSnapshot(snapshot);
          }
        )
        .on("system", {}, (payload) => {
          if (payload.status === "ok") {
            markConnected(channel.topic);
          } else {
            markDisconnected(channel.topic);
          }
        });
      return channel;
    });
    const channels = [preferenceChannel, ...snapshotChannels];
    expectedChannelCount = channels.length;
    void client.realtime.setAuth().then(() => {
      if (!active) return;
      channels.forEach((channel) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED" && channel === preferenceChannel) {
            markConnected(channel.topic);
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            markDisconnected(channel.topic);
            if (status !== "CLOSED") {
              reportFailedResult({ ok: false, code: status }, {
                operation: "realtime.presence.subscribe",
                recoverable: true,
                runtime: "browser",
              });
            }
          }
        });
      });
    }).catch((error) => {
      reportOperationalError(error, {
        operation: "realtime.presence.authenticate",
        handled: true,
        recoverable: true,
        runtime: "browser",
      });
      onStatus?.("disconnected");
    });
    return () => {
      active = false;
      channels.forEach((channel) => void client.removeChannel(channel));
    };
  },

  startSession(onSnapshot, onError) {
    const client = createBrowserSupabaseClient();
    const sessionId = makeSessionId();
    let stopped = false;
    let lastActivityAt = Date.now();
    let activityVersion = 1;
    let acknowledgedActivityVersion = 0;
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let writing = false;
    let endRequested = false;
    let writeFailureReported = false;

    async function write(ended = false) {
      if (stopped && !ended) return;
      if (writing) {
        if (ended) endRequested = true;
        return;
      }
      writing = true;
      const sentActivityVersion = activityVersion;
      const activity = sentActivityVersion > acknowledgedActivityVersion;
      const { data, error } = await client.rpc("touch_presence_session", {
        p_session_id: sessionId,
        p_activity: activity,
        p_ended: ended,
      });
      writing = false;

      if (!error) {
        writeFailureReported = false;
        retryAttempt = 0;
        acknowledgedActivityVersion = Math.max(
          acknowledgedActivityVersion,
          sentActivityVersion
        );
        const snapshot = readSnapshot(data);
        if (snapshot) onSnapshot?.(snapshot);
        if (endRequested) {
          endRequested = false;
          void write(true);
        }
        return;
      }

      // Ending a presence session is best-effort. During sign-out the auth
      // session can disappear before this final RPC reaches Supabase, and
      // page teardown can interrupt it entirely. Neither case affects the
      // user or benefits from retrying/reporting after the controller has
      // already stopped.
      if (stopped && ended) return;

      if (!writeFailureReported) {
        writeFailureReported = true;
        reportOperationalError(error, {
          operation: "realtime.presence.heartbeat",
          handled: true,
          recoverable: true,
          runtime: "browser",
        });
      }
      onError?.();
      if (endRequested) {
        endRequested = false;
        void write(true);
        return;
      }
      if (stopped || ended || retryTimer) return;
      const delays = [5_000, 10_000, 30_000];
      const delay = delays[Math.min(retryAttempt, delays.length - 1)] ?? 30_000;
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void write(false);
      }, delay);
    }

    function markActive() {
      if (stopped) return;
      const now = Date.now();
      const wasIdle = now - lastActivityAt >= PRESENCE_IDLE_MS;
      lastActivityAt = now;
      activityVersion += 1;
      if (wasIdle) void write(false);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") markActive();
    }

    function handleOnline() {
      markActive();
      void write(false);
    }

    const activityEvents = ["pointerdown", "keydown", "scroll", "focus"] as const;
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActive, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    void write(false);
    const interval = setInterval(() => void write(false), PRESENCE_HEARTBEAT_MS);

    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActive);
      });
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      void write(true);
    };
    window.addEventListener("pagehide", stop, { once: true });

    return {
      markActive,
      stop() {
        window.removeEventListener("pagehide", stop);
        stop();
      },
    };
  },
};
