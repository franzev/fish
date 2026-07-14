import {
  createInitialNotificationState,
  reduceNotificationState,
  type NotificationEvent,
  type NotificationItem,
  type NotificationState,
} from "@fish/core/notification-state";
import vectors from "@fish/core/notification-state/fixtures/notification-state-vectors.json";
import { describe, expect, it } from "vitest";

const item = (
  id: string,
  category: NotificationItem["category"],
  categoryRank: number,
  changeSeq: number
): NotificationItem => ({
  id,
  kind: category === "actionRequired" ? "friendRequestReceived" : "messageMention",
  category,
  categoryRank,
  actor: null,
  actorCount: 0,
  eventCount: 1,
  conversationId: null,
  channelSlug: null,
  channelName: null,
  messageId: null,
  messageSnippet: null,
  callId: null,
  friendRequestId: null,
  moderationActionId: null,
  title: null,
  body: null,
  actionHref: null,
  seenAt: null,
  readAt: null,
  lastEventAt: `2026-07-14T00:00:${String(changeSeq).padStart(2, "0")}.000Z`,
  changeSeq,
});

const page = {
  items: [item("direct", "direct", 1, 12), item("action", "actionRequired", 2, 10)],
  nextCursor: null,
};
const summary = { unreadCount: 2, unseenCount: 2, latestChangeSeq: 12 };

function replay(events: Array<Record<string, unknown>>): NotificationState {
  let state = createInitialNotificationState();
  const operationId = "fixture-operation";
  for (const event of events) {
    let value: NotificationEvent;
    if (event.type === "hydrate") {
      value = { type: "hydrate", page, summary, filter: "all" };
    } else if (event.type === "optimisticOperation") {
      value = {
        type: "optimisticOperation",
        operationId,
        operationKind: event.operationKind as "read" | "markAllRead",
        itemIds: event.notificationIds as string[] | undefined,
        throughChangeSeq: event.throughChangeSeq as number,
        occurredAt: "2026-07-14T01:00:00.000Z",
      };
    } else if (event.type === "operationFailed") {
      value = { type: "operationFailed", operationId };
    } else {
      value = {
        type: "changesApplied",
        changes: [{
          id: event.notificationId as string,
          changeSeq: event.changeSeq as number,
          seenAt: null,
          readAt: null,
          archivedAt: null,
        }],
      };
    }
    state = reduceNotificationState(state, value);
  }
  return state;
}

describe("portable notification-state vectors", () => {
  for (const vector of vectors) {
    it(vector.name, () => {
      const state = replay(vector.events);
      const actual = {
        itemIds: state.items.map((entry) => entry.id),
        unreadCount: state.summary.unreadCount,
        unreadItemIds: state.items.filter((entry) => entry.readAt === null).map((entry) => entry.id),
        needsRefresh: state.needsRefresh,
        latestChangeSeq: state.summary.latestChangeSeq,
      };
      expect(actual).toMatchObject(vector.expected);
    });
  }

  it("applies known acknowledgement changes without waiting for a full refresh", () => {
    const hydrated = replay([{ type: "hydrate" }]);
    const state = reduceNotificationState(hydrated, {
      type: "changesApplied",
      changes: [{
        id: "action",
        changeSeq: 13,
        seenAt: "2026-07-14T01:00:00.000Z",
        readAt: "2026-07-14T01:00:00.000Z",
        archivedAt: null,
      }],
    });
    expect(state.summary).toEqual({
      unreadCount: 1,
      unseenCount: 1,
      latestChangeSeq: 13,
    });
    expect(state.needsRefresh).toBe(false);
  });

  it("rolls back only the failed operation summary delta", () => {
    let state = replay([{ type: "hydrate" }]);
    state = reduceNotificationState(state, {
      type: "optimisticOperation",
      operationId: "first",
      operationKind: "read",
      itemIds: ["action"],
      throughChangeSeq: 12,
      occurredAt: "2026-07-14T01:00:00.000Z",
    });
    state = reduceNotificationState(state, {
      type: "optimisticOperation",
      operationId: "second",
      operationKind: "read",
      itemIds: ["direct"],
      throughChangeSeq: 12,
      occurredAt: "2026-07-14T01:00:00.000Z",
    });
    state = reduceNotificationState(state, { type: "operationConfirmed", operationId: "second" });
    state = reduceNotificationState(state, { type: "operationFailed", operationId: "first" });
    expect(state.summary.unreadCount).toBe(1);
    expect(state.items.find((entry) => entry.id === "action")?.readAt).toBeNull();
    expect(state.items.find((entry) => entry.id === "direct")?.readAt).not.toBeNull();
  });

  it("preserves a pending optimistic overlay across an authoritative refresh", () => {
    let state = replay([{ type: "hydrate" }]);
    state = reduceNotificationState(state, {
      type: "optimisticOperation",
      operationId: "mark-all",
      operationKind: "markAllRead",
      throughChangeSeq: 12,
      occurredAt: "2026-07-14T01:00:00.000Z",
    });

    state = reduceNotificationState(state, {
      type: "hydrate",
      page,
      summary,
      filter: "all",
    });

    expect(state.summary.unreadCount).toBe(0);
    expect(state.pendingOperations["mark-all"]).toBeDefined();

    state = reduceNotificationState(state, {
      type: "operationFailed",
      operationId: "mark-all",
    });

    expect(state.summary.unreadCount).toBe(2);
    expect(state.items.every((entry) => entry.readAt === null)).toBe(true);
  });
});
