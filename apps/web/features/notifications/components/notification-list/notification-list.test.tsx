import { fireEvent, render, screen, within } from "@testing-library/react";
import type { NotificationItem } from "@fish/core/notification-state";
import type {
  AttentionRealtimeService,
  NavigationAttentionRepository,
  NotificationCommandService,
  NotificationRealtimeService,
  NotificationRepository,
} from "@/lib/services";
import { resolvedService } from "@/lib/services/testing";
import { describe, expect, it, vi } from "vitest";
import { NotificationProvider } from "../notification-provider";
import { NotificationList } from "./notification-list";

function item(input: Partial<NotificationItem> & Pick<NotificationItem, "id" | "kind" | "category" | "categoryRank">): NotificationItem {
  return {
    actor: { id: "actor-1", displayName: "Sam", username: "sam" },
    actorCount: 1,
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
    lastEventAt: "2026-07-14T00:00:00.000Z",
    changeSeq: 1,
    ...input,
  };
}

const items = [
  item({ id: "friend", kind: "friendRequestReceived", category: "actionRequired", categoryRank: 2, friendRequestId: "request-1" }),
  item({ id: "mention", kind: "messageMention", category: "direct", categoryRank: 1, channelName: "general", messageSnippet: "Can you help?" }),
  item({ id: "call", kind: "callCompleted", category: "update", categoryRank: 0, readAt: "2026-07-14T00:30:00.000Z" }),
];

function renderList() {
  const repository: NotificationRepository = {
    getSummary: vi.fn(() => resolvedService({ unreadCount: 2, unseenCount: 2, latestChangeSeq: 1 })),
    listPage: vi.fn(({ filter }) => resolvedService({
      items: filter === "unread" ? items.filter((entry) => entry.readAt === null) : items,
      nextCursor: null,
    })),
    listChanges: vi.fn(() => resolvedService([])),
  };
  const commands: NotificationCommandService = {
    execute: vi.fn(async (command) => command.action === "archive-read"
      ? { ok: true as const, updated: 1, archiveBatchId: "11111111-1111-4111-8111-111111111111" }
      : { ok: true as const, updated: 1 }),
  };
  const realtime: NotificationRealtimeService = { subscribe: vi.fn(() => vi.fn()) };
  const attentionRepository: NavigationAttentionRepository = { list: vi.fn(() => resolvedService([])) };
  const attentionRealtime: AttentionRealtimeService = { subscribe: vi.fn(() => vi.fn()) };
  render(
    <NotificationProvider
      userId="user-1"
      initialPage={{ items, nextCursor: null }}
      initialSummary={{ unreadCount: 2, unseenCount: 2, latestChangeSeq: 1 }}
      initialAttention={[]}
      repository={repository}
      commands={commands}
      realtime={realtime}
      attentionRepository={attentionRepository}
      attentionRealtime={attentionRealtime}
    >
      <NotificationList />
    </NotificationProvider>
  );
  return { repository, commands };
}

describe("NotificationList", () => {
  it("uses a calm priority hierarchy and preserves unread semantics", () => {
    renderList();
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual(["Needs you", "For you", "Updates"]);
    expect(screen.getByText("Sam sent you a friend request")).toBeVisible();
    expect(screen.getByText("Sam mentioned you")).toBeVisible();
    expect(screen.getByText("Call with Sam completed")).toBeVisible();
    expect(screen.getAllByText("Unread", { selector: "span.sr-only" })).toHaveLength(2);
  });

  it("filters to unread without adding category choices", async () => {
    const { repository } = renderList();
    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(await screen.findByText("Sam mentioned you")).toBeVisible();
    expect(screen.queryByText("Call with Sam completed")).toBeNull();
    expect(repository.listPage).toHaveBeenCalledWith({ filter: "unread" });
  });

  it("keeps bulk actions in one quiet overflow menu", async () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Notification actions" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Mark all as read" })).toBeVisible();
    expect(within(menu).getByRole("menuitem", { name: "Clear read notifications" })).toBeVisible();
  });

  it("keeps clear context visible beside the exact undo action", async () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Notification actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Clear read notifications" }));

    expect(await screen.findByText("Read notifications cleared.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Undo" })).toBeVisible();
  });
});
