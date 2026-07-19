import { describe, expect, it } from "vitest";
import { findFirstUnreadMessageId, timestampsMatch } from "./first-unread";

const messages = [
  { id: "mine", senderId: "client-1", createdAt: "2026-07-19T01:00:00.000000Z" },
  { id: "deleted", senderId: "coach-1", createdAt: "2026-07-19T01:00:01.123456Z", deletedAt: "2026-07-19T01:01:00.000Z" },
  { id: "unread", senderId: "coach-1", createdAt: "2026-07-19T01:00:02.123456Z" },
];

describe("first unread boundary", () => {
  it("matches Postgres microseconds without confusing milliseconds", () => {
    expect(timestampsMatch("2026-07-19T01:00:02.123456Z", "2026-07-19T01:00:02.123456Z")).toBe(true);
    expect(timestampsMatch("2026-07-19T01:00:02.123456Z", "2026-07-19T01:00:02.123457Z")).toBe(false);
  });

  it("skips own and deleted messages", () => {
    expect(
      findFirstUnreadMessageId(messages, {
        count: 1,
        oldestUnreadAt: "2026-07-19T01:00:02.123456Z",
      }, "client-1")
    ).toBe("unread");
  });

  it("returns null for an empty or unloaded boundary", () => {
    expect(findFirstUnreadMessageId(messages, { count: 0, oldestUnreadAt: null }, "client-1")).toBeNull();
    expect(findFirstUnreadMessageId(messages, { count: 1, oldestUnreadAt: "missing" }, "client-1")).toBeNull();
  });
});
