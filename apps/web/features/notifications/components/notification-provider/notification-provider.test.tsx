import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NotificationItem } from "@fish/core/notification-state";
import type {
  AttentionRealtimeService,
  NavigationAttentionRepository,
  NotificationCommandResult,
  NotificationCommandService,
  NotificationRealtimeHint,
  NotificationRealtimeService,
  NotificationRepository,
} from "@/lib/services";
import { resolvedService } from "@/lib/services/testing";
import { describe, expect, it, vi } from "vitest";
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
    subscribe: vi.fn(() => vi.fn()),
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
  };
}

function Harness() {
  const { state, markRead } = useNotifications();
  return (
    <div>
      <output aria-label="Unread count">{state.summary.unreadCount}</output>
      <button type="button" onClick={() => void markRead(state.items[0])}>Read</button>
    </div>
  );
}

function renderProvider(
  deps: ReturnType<typeof dependencies>
) {
  return render(
    <NotificationProvider
      userId="user-1"
      initialPage={{ items: [notification], nextCursor: null }}
      initialSummary={{ unreadCount: 1, unseenCount: 1, latestChangeSeq: 1 }}
      initialAttention={[]}
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
