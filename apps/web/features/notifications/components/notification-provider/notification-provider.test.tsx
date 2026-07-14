import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NotificationItem } from "@fish/core/notification-state";
import {
  ServiceError,
  serviceFailure,
  type AttentionRealtimeService,
  type NavigationAttention,
  type NavigationAttentionRepository,
  type NotificationCommandResult,
  type NotificationCommandService,
  type NotificationRealtimeHint,
  type NotificationRealtimeService,
  type NotificationRepository,
} from "@/lib/services";
import { resolvedService } from "@/lib/services/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider, useNotifications } from "./notification-provider";

const notification: NotificationItem = {
  id: "notification-1",
  kind: "messageMention",
  category: "direct",
  categoryRank: 1,
  actor: { id: "actor-1", displayName: "Sam", username: "sam" },
  actorCount: 1,
  eventCount: 1,
  conversationId: "conversation-1",
  channelSlug: "general",
  channelName: "general",
  messageId: "message-1",
  messageSnippet: "Hi @alex",
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

function dependencies(command: NotificationCommandService["execute"]) {
  let onHint: ((hint: NotificationRealtimeHint) => void) | null = null;
  let onAttentionChange: ((conversationId: string) => void) | null = null;
  const repository: NotificationRepository = {
    getSummary: vi.fn(() => resolvedService({ unreadCount: 1, unseenCount: 1, latestChangeSeq: 1 })),
    listPage: vi.fn(() => resolvedService({ items: [notification], nextCursor: null })),
    listChanges: vi.fn(() => resolvedService([])),
  };
  const realtime: NotificationRealtimeService = {
    subscribe: vi.fn((_userId, handler) => {
      onHint = handler;
      return vi.fn();
    }),
  };
  const attentionRepository: NavigationAttentionRepository = {
    list: vi.fn(() => resolvedService([])),
  };
  const attentionRealtime: AttentionRealtimeService = {
    subscribe: vi.fn((_conversationIds, onChange) => {
      onAttentionChange = onChange;
      return vi.fn();
    }),
  };
  return {
    repository,
    realtime,
    attentionRepository,
    attentionRealtime,
    commands: { execute: command },
    emit(hint: NotificationRealtimeHint) {
      onHint?.(hint);
    },
    emitAttention(conversationId: string) {
      onAttentionChange?.(conversationId);
    },
  };
}

function conversationAttention(
  conversationId: string,
  unreadCount: number,
  surface: "direct" | "channel" = "direct"
): NavigationAttention {
  return {
    surface,
    entityId: conversationId,
    conversationId,
    unreadCount,
    mentionCount: 0,
    newActivity: unreadCount > 0,
  };
}

function Harness() {
  const { state, notice, markRead, refreshAndMarkLoadedSeen } = useNotifications();
  return (
    <div>
      <output aria-label="Unread count">{state.summary.unreadCount}</output>
      <output aria-label="Unseen count">{state.summary.unseenCount}</output>
      {notice && <output aria-label="Notification notice">{notice}</output>}
      <button type="button" onClick={() => void markRead(state.items[0])}>Read</button>
      <button type="button" onClick={() => void refreshAndMarkLoadedSeen()}>
        Open notifications
      </button>
    </div>
  );
}

function renderProvider(
  deps: ReturnType<typeof dependencies>,
  initialAttention: NavigationAttention[] = []
) {
  return render(
    <NotificationProvider
      userId="user-1"
      initialPage={{ items: [notification], nextCursor: null }}
      initialSummary={{ unreadCount: 1, unseenCount: 1, latestChangeSeq: 1 }}
      initialAttention={initialAttention}
      repository={deps.repository}
      commands={deps.commands}
      realtime={deps.realtime}
      attentionRepository={deps.attentionRepository}
      attentionRealtime={deps.attentionRealtime}
    >
      <Harness />
    </NotificationProvider>
  );
}

describe("NotificationProvider", () => {
  afterEach(() => {
    document.title = "";
  });

  it("shows the number of unread conversations in the browser tab, not the number of messages", () => {
    document.title = "FISH";
    const deps = dependencies(vi.fn(async () => ({ ok: true as const, updated: 0 })));
    const view = renderProvider(deps, [
      conversationAttention("direct-1", 596),
      conversationAttention("channel-1", 4, "channel"),
      conversationAttention("channel-1", 4, "channel"),
      conversationAttention("read-conversation", 0),
      {
        surface: "friends",
        entityId: null,
        conversationId: null,
        unreadCount: 8,
        mentionCount: 0,
        newActivity: true,
      },
    ]);

    expect(document.title).toBe("(2) FISH");
    view.unmount();
    expect(document.title).toBe("FISH");
  });

  it("keeps the browser tab calm by capping counts at nine plus", () => {
    const deps = dependencies(vi.fn(async () => ({ ok: true as const, updated: 0 })));
    renderProvider(
      deps,
      Array.from({ length: 12 }, (_, index) =>
        conversationAttention(`conversation-${index}`, 1)
      )
    );

    expect(document.title).toBe("(9+) FISH");
  });

  it("updates and clears the browser tab from canonical realtime attention", async () => {
    const deps = dependencies(vi.fn(async () => ({ ok: true as const, updated: 0 })));
    const readConversation = conversationAttention("conversation-1", 0);
    renderProvider(deps, [readConversation]);

    expect(document.title).toBe("FISH");
    expect(deps.attentionRealtime.subscribe).toHaveBeenCalledWith(
      ["conversation-1"],
      expect.any(Function),
      expect.any(Function)
    );

    vi.mocked(deps.attentionRepository.list).mockReturnValueOnce(
      resolvedService([conversationAttention("conversation-1", 3)])
    );
    act(() => deps.emitAttention("conversation-1"));
    await waitFor(() => expect(document.title).toBe("(1) FISH"));

    vi.mocked(deps.attentionRepository.list).mockReturnValueOnce(
      resolvedService([readConversation])
    );
    act(() => deps.emitAttention("conversation-1"));
    await waitFor(() => expect(document.title).toBe("FISH"));
  });

  it("applies read commands optimistically and confirms them", async () => {
    let resolveCommand: (result: NotificationCommandResult) => void = () => undefined;
    const execute = vi.fn(() => new Promise<NotificationCommandResult>((resolve) => {
      resolveCommand = resolve;
    }));
    const deps = dependencies(execute);
    renderProvider(deps);

    fireEvent.click(screen.getByRole("button", { name: "Read" }));
    expect(screen.getByLabelText("Unread count")).toHaveTextContent("0");
    await act(async () => resolveCommand({ ok: true, updated: 1 }));
    expect(execute).toHaveBeenCalledWith({
      action: "mark-read",
      notificationIds: ["notification-1"],
      throughChangeSeq: 1,
    });
  });

  it("rolls back a failed optimistic update with calm state intact", async () => {
    const deps = dependencies(vi.fn(async () => ({
      ok: false as const,
      code: "network",
      notice: "Notifications will catch up.",
    })));
    renderProvider(deps);
    fireEvent.click(screen.getByRole("button", { name: "Read" }));
    await waitFor(() => expect(screen.getByLabelText("Unread count")).toHaveTextContent("1"));
  });

  it("marks notifications returned by the opening refresh as seen", async () => {
    const execute = vi.fn(async () => ({ ok: true as const, updated: 1 }));
    const deps = dependencies(execute);
    const refreshed = {
      ...notification,
      id: "notification-2",
      changeSeq: 2,
    };
    vi.mocked(deps.repository.listPage)
      .mockReturnValueOnce(
        resolvedService({ items: [refreshed], nextCursor: null })
      )
      .mockReturnValueOnce(
        resolvedService({
          items: [{ ...refreshed, seenAt: "2026-07-14T01:00:00.000Z" }],
          nextCursor: null,
        })
      );
    vi.mocked(deps.repository.getSummary)
      .mockReturnValueOnce(
        resolvedService({ unreadCount: 1, unseenCount: 1, latestChangeSeq: 2 })
      )
      .mockReturnValueOnce(
        resolvedService({ unreadCount: 1, unseenCount: 0, latestChangeSeq: 3 })
      );
    renderProvider(deps);

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    await waitFor(() => expect(execute).toHaveBeenCalledWith({
      action: "mark-seen",
      notificationIds: ["notification-2"],
      throughChangeSeq: 2,
    }));
    expect(screen.getByLabelText("Unseen count")).toHaveTextContent("0");
  });

  it("retries when a notification changes during the mark-seen snapshot", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ ok: true as const, updated: 0 })
      .mockResolvedValueOnce({ ok: true as const, updated: 1 });
    const deps = dependencies(execute);
    const firstSnapshot = {
      ...notification,
      id: "notification-2",
      changeSeq: 2,
    };
    const changedSnapshot = { ...firstSnapshot, changeSeq: 3 };
    vi.mocked(deps.repository.listPage)
      .mockReturnValueOnce(
        resolvedService({ items: [firstSnapshot], nextCursor: null })
      )
      .mockReturnValueOnce(
        resolvedService({ items: [changedSnapshot], nextCursor: null })
      )
      .mockReturnValueOnce(
        resolvedService({
          items: [{ ...changedSnapshot, seenAt: "2026-07-14T01:00:00.000Z" }],
          nextCursor: null,
        })
      );
    vi.mocked(deps.repository.getSummary)
      .mockReturnValueOnce(
        resolvedService({ unreadCount: 1, unseenCount: 1, latestChangeSeq: 2 })
      )
      .mockReturnValueOnce(
        resolvedService({ unreadCount: 1, unseenCount: 1, latestChangeSeq: 3 })
      )
      .mockReturnValueOnce(
        resolvedService({ unreadCount: 1, unseenCount: 0, latestChangeSeq: 4 })
      );
    renderProvider(deps);

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(execute).toHaveBeenNthCalledWith(1, {
      action: "mark-seen",
      notificationIds: ["notification-2"],
      throughChangeSeq: 2,
    });
    expect(execute).toHaveBeenNthCalledWith(2, {
      action: "mark-seen",
      notificationIds: ["notification-2"],
      throughChangeSeq: 3,
    });
    expect(screen.getByLabelText("Unseen count")).toHaveTextContent("0");
  });

  it("keeps canonical unseen state when no rows update and the refetch fails", async () => {
    const execute = vi.fn(async () => ({ ok: true as const, updated: 0 }));
    const deps = dependencies(execute);
    const failure = serviceFailure(new ServiceError({
      code: "network",
      message: "Connection interrupted.",
      recoverable: true,
    }));
    vi.mocked(deps.repository.listPage)
      .mockReturnValueOnce(
        resolvedService({ items: [notification], nextCursor: null })
      )
      .mockReturnValueOnce(Promise.resolve(failure));
    vi.mocked(deps.repository.getSummary)
      .mockReturnValueOnce(
        resolvedService({ unreadCount: 1, unseenCount: 1, latestChangeSeq: 1 })
      )
      .mockReturnValueOnce(Promise.resolve(failure));
    renderProvider(deps);

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText("Notification notice"))
      .toHaveTextContent("Notifications will catch up when the connection settles."));
    expect(screen.getByLabelText("Unseen count")).toHaveTextContent("1");
  });

  it("treats realtime as a wakeup hint and re-anchors on canonical data", async () => {
    const deps = dependencies(vi.fn(async () => ({ ok: true as const, updated: 1 })));
    const refreshed = { ...notification, id: "notification-2", changeSeq: 2 };
    vi.mocked(deps.repository.listChanges).mockReturnValueOnce(resolvedService([{
      id: refreshed.id,
      changeSeq: 2,
      seenAt: null,
      readAt: null,
      archivedAt: null,
    }]));
    vi.mocked(deps.repository.listPage).mockReturnValueOnce(
      resolvedService({ items: [refreshed, notification], nextCursor: null })
    );
    vi.mocked(deps.repository.getSummary).mockReturnValueOnce(
      resolvedService({ unreadCount: 2, unseenCount: 2, latestChangeSeq: 2 })
    );
    renderProvider(deps);

    act(() => deps.emit({
      itemId: refreshed.id,
      changeSeq: 2,
      reason: "created",
      occurredAt: "2026-07-14T01:00:00.000Z",
    }));

    await waitFor(() => expect(screen.getByLabelText("Unread count")).toHaveTextContent("2"));
    expect(deps.repository.listChanges).toHaveBeenCalledWith(1);
  });
});
