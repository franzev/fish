import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { belongsToSameMessageGroup, MESSAGE_GROUP_GAP_MS } from "./message-grouping";

// Day-boundary comparisons read the local calendar day (mirrors the
// production `toDateString()` calls this predicate makes), so this file
// pins TZ=UTC while it runs to keep the boundary assertion stable on any
// machine/CI regardless of its default timezone.
const originalTz = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "UTC";
});

afterAll(() => {
  process.env.TZ = originalTz;
});

describe("belongsToSameMessageGroup", () => {
  it("groups two same-sender messages within the short gap on the same day", () => {
    const previous = { senderId: "client-1", createdAt: "2026-07-05T10:00:00.000Z" };
    const current = { senderId: "client-1", createdAt: "2026-07-05T10:02:00.000Z" };

    expect(belongsToSameMessageGroup(previous, current)).toBe(true);
  });

  it("does not group two same-sender messages outside the short gap", () => {
    const previous = { senderId: "client-1", createdAt: "2026-07-05T10:00:00.000Z" };
    const current = { senderId: "client-1", createdAt: "2026-07-05T10:10:00.000Z" };

    expect(belongsToSameMessageGroup(previous, current)).toBe(false);
  });

  it("does not group same-sender messages across a calendar-day boundary", () => {
    const previous = { senderId: "client-1", createdAt: "2026-07-05T23:58:00.000Z" };
    const current = { senderId: "client-1", createdAt: "2026-07-06T00:01:00.000Z" };

    expect(belongsToSameMessageGroup(previous, current)).toBe(false);
  });

  it("does not group adjacent messages from different senders", () => {
    const previous = { senderId: "client-1", createdAt: "2026-07-05T10:00:00.000Z" };
    const current = { senderId: "client-2", createdAt: "2026-07-05T10:00:30.000Z" };

    expect(belongsToSameMessageGroup(previous, current)).toBe(false);
  });

  it("returns false for the first row, which has no previous message", () => {
    const current = { senderId: "client-1", createdAt: "2026-07-05T10:00:00.000Z" };

    expect(belongsToSameMessageGroup(undefined, current)).toBe(false);
  });

  it("documents the grouping gap as five minutes", () => {
    expect(MESSAGE_GROUP_GAP_MS).toBe(5 * 60 * 1000);
  });
});
