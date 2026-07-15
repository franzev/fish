import { describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "./types";
import { SupabasePresenceCommandService } from "./presence-command-service";

const snapshot = {
  userId: "user-1",
  status: "busy" as const,
  lastHeartbeatAt: "2026-07-15T10:00:00.000Z",
  lastSeenAt: "2026-07-15T10:00:00.000Z",
  revision: 3,
  updatedAt: "2026-07-15T10:00:00.000Z",
};

describe("SupabasePresenceCommandService", () => {
  it("sends the selected status duration and maps its authoritative expiry", async () => {
    const setting = {
      preference: "busy" as const,
      expiresAt: "2026-07-15T10:15:00.000Z",
    };
    const invoke = vi.fn(async () => ({
      data: { snapshot, setting },
      error: null,
    }));
    const service = new SupabasePresenceCommandService({
      functions: { invoke },
    } as unknown as AppSupabaseClient);

    await expect(service.setMode("busy", 900)).resolves.toEqual({
      ok: true,
      snapshot,
      setting,
    });
    expect(invoke).toHaveBeenCalledWith("presence-command", {
      body: { mode: "busy", durationSeconds: 900 },
      timeout: 15_000,
    });
  });
});
