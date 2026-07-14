import { render, screen, within } from "@testing-library/react";
import { AppShell } from "@/components/shell/app-shell";
import type {
  AttentionRealtimeService,
  NavigationAttentionRepository,
  NotificationCommandService,
  NotificationRealtimeService,
  NotificationRepository,
} from "@/lib/services";
import { resolvedService } from "@/lib/services/testing";
import { describe, expect, it, vi } from "vitest";
import { NotificationProvider } from "./notification-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/channels/general",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/auth/client/browser", () => ({
  signOut: vi.fn(async () => ({ ok: true, data: undefined })),
}));

describe("navigation attention badges", () => {
  it("keeps Friends out of primary navigation while showing channel attention", () => {
    const repository: NotificationRepository = {
      getSummary: vi.fn(() => resolvedService({ unreadCount: 0, unseenCount: 0, latestChangeSeq: 0 })),
      listPage: vi.fn(() => resolvedService({ items: [], nextCursor: null })),
      listChanges: vi.fn(() => resolvedService([])),
    };
    const attention = [
      { surface: "friends" as const, entityId: null, conversationId: null, unreadCount: 2, mentionCount: 0, newActivity: true },
      { surface: "direct" as const, entityId: "coach-1", conversationId: "conversation-direct", unreadCount: 7, mentionCount: 0, newActivity: true },
      { surface: "channel" as const, entityId: "22222222-2222-4222-8222-222222222222", conversationId: "conversation-general", unreadCount: 5, mentionCount: 3, newActivity: true },
      { surface: "channel" as const, entityId: "33333333-3333-4333-8333-333333333333", conversationId: "conversation-intros", unreadCount: 4, mentionCount: 0, newActivity: true },
    ];
    const attentionRepository: NavigationAttentionRepository = {
      list: vi.fn(() => resolvedService(attention)),
    };
    const commands: NotificationCommandService = {
      execute: vi.fn(async () => ({ ok: true as const, updated: 0 })),
    };
    const realtime: NotificationRealtimeService = { subscribe: vi.fn(() => vi.fn()) };
    const attentionRealtime: AttentionRealtimeService = { subscribe: vi.fn(() => vi.fn()) };

    render(
      <NotificationProvider
        userId="user-1"
        initialPage={{ items: [], nextCursor: null }}
        initialSummary={{ unreadCount: 0, unseenCount: 0, latestChangeSeq: 0 }}
        initialAttention={attention}
        repository={repository}
        commands={commands}
        realtime={realtime}
        attentionRepository={attentionRepository}
        attentionRealtime={attentionRealtime}
      >
        <AppShell displayName="Alex" role="client" friendsNavEnabled>
          Content
        </AppShell>
      </NotificationProvider>
    );

    const primary = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(primary).queryByRole("link", { name: /Friends/ })
    ).not.toBeInTheDocument();
    expect(
      within(primary).queryByRole("link", { name: /Messages/ })
    ).not.toBeInTheDocument();
    const messages = screen.getByRole("link", { name: "Messages, 7 unread" });
    expect(messages).toHaveAttribute("href", "/messages");
    expect(messages).toHaveTextContent("7");
    expect(messages).not.toHaveTextContent("Messages");
    expect(messages.className).toContain("size-control");
    expect(within(primary).getByRole("link", { name: /Community/ })).toHaveTextContent("@3");
    const channels = screen.getByRole("navigation", { name: "Channels" });
    expect(within(channels).getByRole("link", { name: /general/ })).toHaveTextContent("@3");
    expect(within(channels).getByRole("link", { name: /introduce yourself/ }))
      .toHaveTextContent("New activity");
  });
});
