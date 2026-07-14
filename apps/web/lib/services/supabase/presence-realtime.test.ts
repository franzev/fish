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
  };
  return { channels, client };
});

vi.mock("./browser", () => ({
  createBrowserSupabaseClient: () => runtime.client,
}));

import { supabasePresenceRealtimeService } from "./presence-realtime";

const userId = "11111111-1111-4111-8111-111111111111";

describe("supabasePresenceRealtimeService", () => {
  beforeEach(() => {
    runtime.channels.splice(0);
    runtime.client.channel.mockClear();
    runtime.client.realtime.setAuth.mockClear();
    runtime.client.removeChannel.mockClear();
  });

  it("bounds snapshot subscriptions and recovers only after replication is ready", async () => {
    const subjectIds = Array.from({ length: 205 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
    );
    const onSnapshot = vi.fn();
    const onRecovery = vi.fn();
    const onStatus = vi.fn();

    const unsubscribe = supabasePresenceRealtimeService.subscribe(
      userId,
      subjectIds,
      onSnapshot,
      vi.fn(),
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
        handler.filter.event === "presence.subjects.changed"
      )
      ?.callback({});
    expect(onRecovery).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(runtime.client.removeChannel).toHaveBeenCalledTimes(4);
  });
});
