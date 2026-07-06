import { describe, expect, it } from "vitest";
import { formatPresenceStatus } from "./presence";

const now = new Date("2026-07-06T04:15:00.000Z");

describe("formatPresenceStatus", () => {
  it("shows Active now with the online dot for a recently active online participant", () => {
    expect(
      formatPresenceStatus(
        {
          online: true,
          activeNow: true,
          lastSeenAt: "2026-07-06T04:14:45.000Z",
        },
        now,
        "12h"
      )
    ).toEqual({ label: "Active now", showOnlineDot: true });
  });

  it("shows Online with the online dot when connected but idle", () => {
    expect(
      formatPresenceStatus(
        {
          online: true,
          activeNow: false,
          lastSeenAt: "2026-07-06T04:10:00.000Z",
        },
        now,
        "12h"
      )
    ).toEqual({ label: "Online", showOnlineDot: true });
  });

  it("formats recent last-seen timestamps without the online dot", () => {
    expect(
      formatPresenceStatus(
        {
          online: false,
          activeNow: false,
          lastSeenAt: "2026-07-06T04:13:00.000Z",
        },
        now,
        "12h"
      )
    ).toEqual({ label: "Last seen 2 minutes ago", showOnlineDot: false });

    expect(
      formatPresenceStatus(
        {
          online: false,
          activeNow: false,
          lastSeenAt: "2026-07-06T03:10:00.000Z",
        },
        now,
        "12h"
      )
    ).toEqual({ label: "Last seen 1 hour ago", showOnlineDot: false });
  });

  it("uses the saved 12-hour preference for yesterday timestamps", () => {
    expect(
      formatPresenceStatus(
        {
          online: false,
          activeNow: false,
          lastSeenAt: "2026-07-05T12:15:00.000Z",
        },
        now,
        "12h"
      )
    ).toEqual({
      label: "Last seen yesterday at 8:15 PM",
      showOnlineDot: false,
    });
  });

  it("uses the saved 24-hour preference for yesterday timestamps", () => {
    expect(
      formatPresenceStatus(
        {
          online: false,
          activeNow: false,
          lastSeenAt: "2026-07-05T12:15:00.000Z",
        },
        now,
        "24h"
      )
    ).toEqual({
      label: "Last seen yesterday at 20:15",
      showOnlineDot: false,
    });
  });

  it("formats older last-seen dates as calendar dates", () => {
    expect(
      formatPresenceStatus(
        {
          online: false,
          activeNow: false,
          lastSeenAt: "2026-07-04T12:15:00.000Z",
        },
        now,
        "12h"
      )
    ).toEqual({ label: "Last seen on Jul 4, 2026", showOnlineDot: false });
  });
});
