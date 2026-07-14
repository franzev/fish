import type { NotificationItem } from "@fish/core/notification-state";
import { describe, expect, it } from "vitest";
import {
  formatNotificationTime,
  notificationContext,
  notificationTitle,
} from "./presentation";

const base: NotificationItem = {
  id: "notification-1",
  kind: "messageReaction",
  category: "update",
  categoryRank: 0,
  actor: { id: "actor-1", displayName: "Sam", username: "sam" },
  actorCount: 1,
  eventCount: 1,
  conversationId: "conversation-1",
  channelSlug: "general",
  channelName: "general",
  messageId: "message-1",
  messageSnippet: "A calm message",
  callId: null,
  friendRequestId: null,
  moderationActionId: null,
  title: null,
  body: null,
  actionHref: "/channels/general",
  seenAt: null,
  readAt: null,
  lastEventAt: "2026-07-14T00:00:00.000Z",
  changeSeq: 1,
};

describe("notification presentation", () => {
  it("explains collapsed actors and events in plain language", () => {
    expect(notificationTitle({ ...base, actorCount: 3, eventCount: 4 }))
      .toBe("Sam and 2 others added 4 reactions");
    expect(notificationTitle({ ...base, kind: "callMissed", eventCount: 2 }))
      .toBe("2 missed calls from Sam");
  });

  it("confirms when a friend request is accepted", () => {
    expect(notificationTitle({ ...base, kind: "friendRequestAccepted" }))
      .toBe("Sam accepted your friend request");
  });

  it("prefers system body, then the message snippet, then channel context", () => {
    expect(notificationContext({ ...base, body: "Planned maintenance" }))
      .toBe("Planned maintenance");
    expect(notificationContext(base)).toBe("A calm message");
    expect(notificationContext({ ...base, messageSnippet: null })).toBe("# general");
  });

  it("formats compact, non-judgemental elapsed time", () => {
    const now = Date.parse("2026-07-14T01:30:00.000Z");
    expect(formatNotificationTime("2026-07-14T01:29:40.000Z", now)).toBe("Now");
    expect(formatNotificationTime("2026-07-14T01:00:00.000Z", now)).toBe("30m");
    expect(formatNotificationTime("2026-07-13T23:30:00.000Z", now)).toBe("2h");
  });
});
