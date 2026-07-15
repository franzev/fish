import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

type ChannelHandler = {
  type: string;
  filter: Record<string, unknown>;
  callback: (payload: Record<string, unknown>) => void;
};

const runtime = vi.hoisted(() => {
  const channels: Array<{
    topic: string;
    options: unknown;
    handlers: ChannelHandler[];
    subscribe: (callback: (status: string) => void) => unknown;
  }> = [];
  const client = {
    channel: vi.fn((topic: string, options?: unknown) => {
      const handlers: ChannelHandler[] = [];
      const channel = {
        topic,
        options,
        handlers,
        on(
          type: string,
          filter: Record<string, unknown>,
          callback: ChannelHandler["callback"]
        ) {
          handlers.push({ type, filter, callback });
          return channel;
        },
        subscribe(callback: (status: string) => void) {
          callback("SUBSCRIBED");
          return channel;
        },
      };
      channels.push(channel);
      return channel;
    }),
    realtime: { setAuth: vi.fn(async () => undefined) },
    removeChannel: vi.fn(async () => "ok"),
    rpc: vi.fn(async (): Promise<{ data: unknown; error: unknown }> => ({
      data: null,
      error: null,
    })),
  };
  return {
    channels,
    client,
    reportFailedResult: vi.fn(),
    reportOperationalError: vi.fn(),
  };
});

vi.mock("./browser", () => ({
  createBrowserSupabaseClient: () => runtime.client,
}));

vi.mock("@/lib/observability/reporter", () => ({
  reportFailedResult: runtime.reportFailedResult,
  reportOperationalError: runtime.reportOperationalError,
}));

import { supabasePresenceRealtimeService } from "./presence-realtime";

const userId = "11111111-1111-4111-8111-111111111111";

describe("supabasePresenceRealtimeService", () => {
  beforeEach(() => {
    runtime.channels.splice(0);
    runtime.client.channel.mockClear();
    runtime.client.realtime.setAuth.mockClear();
    runtime.client.removeChannel.mockClear();
    runtime.client.rpc.mockReset();
    runtime.client.rpc.mockResolvedValue({ data: null, error: null });
    runtime.reportFailedResult.mockClear();
    runtime.reportOperationalError.mockClear();
  });

  it("bounds snapshot subscriptions and recovers only after replication is ready", async () => {
    const subjectIds = Array.from({ length: 205 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
    );
    const onSnapshot = vi.fn();
    const onPreference = vi.fn();
    const onRecovery = vi.fn();
    const onStatus = vi.fn();

    const unsubscribe = supabasePresenceRealtimeService.subscribe(
      userId,
      subjectIds,
      onSnapshot,
      onPreference,
      onRecovery,
      onStatus
    );

    await waitFor(() => expect(runtime.client.channel).toHaveBeenCalledTimes(4));
    const preferenceChannel = runtime.channels[0];
    const snapshotChannels = runtime.channels.slice(1);
    expect(snapshotChannels).toHaveLength(3);
    expect(onRecovery).not.toHaveBeenCalled();

    for (const channel of snapshotChannels) {
      expect(channel.options).toEqual({
        config: { broadcast: { replication_ready: true } },
      });
      const changes = channel.handlers.find(
        (handler) => handler.type === "postgres_changes"
      );
      const filter = String(changes?.filter.filter);
      const values = filter.slice("user_id=in.(".length, -1).split(",");
      expect(values.length).toBeLessThanOrEqual(100);
      channel.handlers.find((handler) => handler.type === "system")?.callback({
        status: "ok",
      });
    }

    expect(onStatus).toHaveBeenLastCalledWith("connected");
    expect(onRecovery).toHaveBeenCalledTimes(1);

    snapshotChannels[0]?.handlers
      .find((handler) => handler.type === "postgres_changes")
      ?.callback({
        new: {
          user_id: userId,
          status: "online",
          last_heartbeat_at: "2026-07-14T00:00:00.000Z",
          last_seen_at: "2026-07-14T00:00:00.000Z",
          revision: 2,
          updated_at: "2026-07-14T00:00:00.000Z",
        },
      });
    expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      status: "online",
      revision: 2,
    }));

    preferenceChannel?.handlers
      .find((handler) =>
        handler.type === "broadcast" &&
        handler.filter.event === "presence.preference.changed"
      )
      ?.callback({
        payload: {
          mode: "busy",
          expiresAt: "2026-07-14T08:00:00.000Z",
          revision: 3,
        },
      });
    expect(onPreference).toHaveBeenCalledWith({
      preference: "busy",
      expiresAt: "2026-07-14T08:00:00.000Z",
    }, 3);

    preferenceChannel?.handlers
      .find((handler) =>
        handler.type === "broadcast" &&
        handler.filter.event === "presence.subjects.changed"
      )
      ?.callback({});
    expect(onRecovery).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(runtime.client.removeChannel).toHaveBeenCalledTimes(4);
  });

  it("does not report a best-effort final heartbeat rejected during teardown", async () => {
    const teardownError = { code: "P0001", message: "not authenticated" };
    runtime.client.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: teardownError });
    const onError = vi.fn();

    const session = supabasePresenceRealtimeService.startSession(
      undefined,
      onError
    );
    await waitFor(() => expect(runtime.client.rpc).toHaveBeenCalledTimes(1));

    session.stop();

    await waitFor(() => expect(runtime.client.rpc).toHaveBeenCalledTimes(2));
    expect(runtime.client.rpc).toHaveBeenLastCalledWith(
      "touch_presence_session",
      expect.objectContaining({ p_ended: true })
    );
    expect(runtime.reportOperationalError).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("continues to report an active-session heartbeat failure", async () => {
    const heartbeatError = { code: "P0001", message: "database unavailable" };
    runtime.client.rpc.mockResolvedValueOnce({
      data: null,
      error: heartbeatError,
    });
    const onError = vi.fn();

    const session = supabasePresenceRealtimeService.startSession(
      undefined,
      onError
    );

    await waitFor(() =>
      expect(runtime.reportOperationalError).toHaveBeenCalledWith(
        heartbeatError,
        {
          operation: "realtime.presence.heartbeat",
          handled: true,
          recoverable: true,
          runtime: "browser",
        }
      )
    );
    expect(onError).toHaveBeenCalledOnce();
    session.stop();
  });
});
