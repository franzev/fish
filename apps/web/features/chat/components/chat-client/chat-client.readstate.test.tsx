import { describe, expect, it } from "vitest";
import { findFirstUnreadMessageId } from "../chat-message-list/first-unread";

describe("ChatClient read-state boundary", () => {
  it("keeps an unread marker inside the loaded window at microsecond precision", () => {
    const messages = [
      {
        id: "message-read",
        createdAt: "2026-07-14T07:25:00.000000Z",
        senderId: "coach-1",
      },
      {
        id: "message-unread",
        createdAt: "2026-07-14T07:25:00.000001Z",
        senderId: "coach-1",
      },
    ];

    expect(
      findFirstUnreadMessageId(messages, {
        count: 1,
        oldestUnreadAt: "2026-07-14T07:25:00.000001Z",
      }, "client-1")
    ).toBe("message-unread");
  });

  it("does not invent an unread boundary when the summary is empty", () => {
    expect(
      findFirstUnreadMessageId(
        [{ id: "message-1", createdAt: "2026-07-14T07:25:00.000000Z", senderId: "coach-1" }],
        { count: 0, oldestUnreadAt: null },
        "client-1"
      )
    ).toBeNull();
  });
});
