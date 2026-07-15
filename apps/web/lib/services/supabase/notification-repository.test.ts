import { describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "./types";
import { SupabaseNotificationRepository } from "./notification-repository";

function row(id: string, categoryRank: number, lastEventAt: string) {
  return {
    id,
    kind: "message_mention",
    category: "direct",
    category_rank: categoryRank,
    actor_id: "actor-1",
    actor_display_name: "Sam Lee",
    actor_username: "sam_lee",
    actor_count: 1,
    event_count: 1,
    conversation_id: "conversation-1",
    channel_slug: "general",
    channel_name: "general",
    message_id: `message-${id}`,
    message_snippet: "Hello there",
    call_id: "",
    friend_request_id: "",
    moderation_action_id: "",
    title: "",
    body: "",
    action_href: "",
    seen_at: "",
    read_at: "",
    last_event_at: lastEventAt,
    change_seq: 7,
  };
}

describe("SupabaseNotificationRepository", () => {
  it("maps the feed, builds stable deep links, and uses limit-plus-one pagination", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        row("one", 1, "2026-07-14T03:00:00.000Z"),
        row("two", 1, "2026-07-14T02:00:00.000Z"),
        row("three", 1, "2026-07-14T01:00:00.000Z"),
      ],
      error: null,
    });
    const repository = new SupabaseNotificationRepository({ rpc } as unknown as AppSupabaseClient);
    const result = await repository.listPage({ filter: "all", limit: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[0]).toMatchObject({
      kind: "messageMention",
      category: "direct",
      actor: { displayName: "Sam Lee" },
      actionHref: "/channels/general?message=message-one#message-message-one",
    });
    expect(result.data.nextCursor).toEqual({
      categoryRank: 1,
      lastEventAt: "2026-07-14T02:00:00.000Z",
      id: "two",
    });
    expect(rpc).toHaveBeenCalledWith("list_notification_items", {
      p_filter: "all",
      p_limit: 2,
    });
  });

  it("maps summary and incremental acknowledgement changes", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{ unread_count: 4, unseen_count: 2, latest_change_seq: 91 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: "notification-1",
          change_seq: 92,
          seen_at: "2026-07-14T04:00:00.000Z",
          read_at: "2026-07-14T04:00:00.000Z",
          archived_at: "",
        }],
        error: null,
      });
    const repository = new SupabaseNotificationRepository({ rpc } as unknown as AppSupabaseClient);
    const summary = await repository.getSummary();
    const changes = await repository.listChanges(91);
    expect(summary).toEqual({
      ok: true,
      data: { unreadCount: 4, unseenCount: 2, latestChangeSeq: 91 },
    });
    expect(changes).toEqual({
      ok: true,
      data: [{
        id: "notification-1",
        changeSeq: 92,
        seenAt: "2026-07-14T04:00:00.000Z",
        readAt: "2026-07-14T04:00:00.000Z",
        archivedAt: null,
      }],
    });
  });

  it("does not link completed calls back to an ended call route", async () => {
    const completedCall = {
      ...row("completed-call", 2, "2026-07-14T04:00:00.000Z"),
      kind: "call_completed",
      category: "update",
      channel_slug: "",
      conversation_id: "",
      message_id: "",
      call_id: "call-1",
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [completedCall],
      error: null,
    });
    const repository = new SupabaseNotificationRepository({ rpc } as unknown as AppSupabaseClient);
    const result = await repository.listPage({ filter: "all" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]).toMatchObject({
      kind: "callCompleted",
      actionHref: null,
    });
  });
});
