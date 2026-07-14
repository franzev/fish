import { describe, expect, it } from "vitest";
import { getPresencePresentation } from "./presentation";

const now = new Date("2026-07-14T05:00:00.000Z");

describe("getPresencePresentation", () => {
  it("expires snapshots locally after the stale-session cutoff", () => {
    expect(getPresencePresentation({
      userId: "user-1",
      status: "online",
      lastHeartbeatAt: "2026-07-14T04:58:29.000Z",
      lastSeenAt: "2026-07-14T04:58:29.000Z",
      revision: 1,
      updatedAt: "2026-07-14T04:58:29.000Z",
    }, now)).toEqual({
      status: "offline",
      label: "Offline",
      detail: "Last seen 1 minute ago",
    });
  });

  it("does not invent last-seen copy for privacy-sanitized snapshots", () => {
    expect(getPresencePresentation({
      userId: "user-1",
      status: "offline",
      lastHeartbeatAt: null,
      lastSeenAt: null,
      revision: 2,
      updatedAt: "2026-07-14T05:00:00.000Z",
    }, now)).toEqual({ status: "offline", label: "Offline", detail: null });
  });
});
