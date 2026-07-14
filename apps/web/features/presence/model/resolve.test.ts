import { describe, expect, it } from "vitest";
import { resolvePresence } from "@fish/core/presence";

const now = new Date("2026-07-14T05:00:00.000Z");

describe("resolvePresence", () => {
  it("resolves active, idle, and stale automatic sessions", () => {
    expect(resolvePresence([{
      activeAt: "2026-07-14T04:59:00.000Z",
      lastHeartbeatAt: "2026-07-14T04:59:40.000Z",
    }], "automatic", now).status).toBe("online");
    expect(resolvePresence([{
      activeAt: "2026-07-14T04:54:59.000Z",
      lastHeartbeatAt: "2026-07-14T04:59:40.000Z",
    }], "automatic", now).status).toBe("idle");
    expect(resolvePresence([{
      activeAt: "2026-07-14T04:50:00.000Z",
      lastHeartbeatAt: "2026-07-14T04:58:29.000Z",
    }], "automatic", now).status).toBe("offline");
  });

  it("lets any active device keep a multi-device account online", () => {
    const result = resolvePresence([
      {
        activeAt: "2026-07-14T04:40:00.000Z",
        lastHeartbeatAt: "2026-07-14T04:59:50.000Z",
      },
      {
        activeAt: "2026-07-14T04:59:20.000Z",
        lastHeartbeatAt: "2026-07-14T04:59:40.000Z",
      },
    ], "automatic", now);
    expect(result.status).toBe("online");
  });

  it("applies away and busy only while a session is fresh", () => {
    const fresh = [{
      activeAt: "2026-07-14T04:59:00.000Z",
      lastHeartbeatAt: "2026-07-14T04:59:40.000Z",
    }];
    expect(resolvePresence(fresh, "away", now).status).toBe("away");
    expect(resolvePresence(fresh, "busy", now).status).toBe("busy");
    expect(resolvePresence([], "busy", now).status).toBe("offline");
  });

  it("sanitizes invisible presence and invalid timestamps", () => {
    const invisible = resolvePresence([{
      activeAt: "2026-07-14T04:59:00.000Z",
      lastHeartbeatAt: "2026-07-14T04:59:40.000Z",
    }], "invisible", now);
    expect(invisible).toEqual({
      status: "offline",
      lastHeartbeatAt: null,
      lastSeenAt: null,
    });
    expect(resolvePresence([{
      activeAt: "invalid",
      lastHeartbeatAt: "invalid",
    }], "automatic", now).status).toBe("offline");
  });
});
