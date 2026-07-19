import { describe, expect, it } from "vitest";
import type { NotificationItem, NotificationPage, NotificationSummary } from "@fish/core/notification-state";
import { markSeenThroughChangeSeq, planMarkSeenOutcome } from "./mark-seen";

const item: NotificationItem = {
  id: "notification-1",
  kind: "messageMention",
  category: "direct",
  categoryRank: 2,
  actor: null,
  actorCount: 1,
  eventCount: 1,
  conversationId: "conversation-1",
  channelSlug: null,
  channelName: null,
  messageId: "message-1",
  messageSnippet: "A note",
  callId: null,
  friendRequestId: null,
  moderationActionId: null,
  title: null,
  body: null,
  actionHref: null,
  seenAt: null,
  readAt: null,
  lastEventAt: "2026-07-14T01:00:00.000Z",
  changeSeq: 12,
};
const page: NotificationPage = { items: [item], nextCursor: null };
const summary: NotificationSummary = { unreadCount: 1, unseenCount: 1, latestChangeSeq: 10 };
const ok = { ok: true as const, updated: 1 };

describe("mark-seen plan", () => {
  it("uses the newest page or summary revision for the command fence", () => {
    expect(markSeenThroughChangeSeq(page, summary)).toBe(12);
  });

  it.each([
    {
      name: "settled refetch",
      settled: {
        page: { items: [{ ...item, seenAt: "2026-07-14T01:01:00.000Z" }], nextCursor: null },
        summary: { ...summary, unseenCount: 0, latestChangeSeq: 13 },
      },
      expectedNotice: null,
      expectedSeen: "2026-07-14T01:01:00.000Z",
    },
    {
      name: "optimistic fallback",
      settled: { page: null, summary: null },
      expectedNotice: "Notifications will catch up when the connection settles.",
      expectedSeen: "2026-07-14T01:02:00.000Z",
    },
  ])("handles $name", ({ settled, expectedNotice, expectedSeen }) => {
    const result = planMarkSeenOutcome({
      page,
      summary,
      commandResult: ok,
      attempt: 0,
      settled,
      seenAt: "2026-07-14T01:02:00.000Z",
    });
    expect(result.notice).toBe(expectedNotice);
    expect(result.nextPage.items[0]?.seenAt).toBe(expectedSeen);
  });

  it("stops on a command failure without changing the snapshot", () => {
    const result = planMarkSeenOutcome({
      page,
      summary,
      commandResult: { ok: false, code: "network", notice: "Try again soon." },
      attempt: 0,
    });
    expect(result).toEqual({ nextPage: page, nextSummary: summary, notice: "Try again soon.", retry: false });
  });
});
