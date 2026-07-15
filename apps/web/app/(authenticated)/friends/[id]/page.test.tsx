import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFriendDetailDataMock } = vi.hoisted(() => ({
  getFriendDetailDataMock: vi.fn(),
}));

vi.mock("@/features/friends/server", () => ({
  friendsFeatureEnabled: () => true,
  getFriendDetailData: getFriendDetailDataMock,
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/chat", () => ({ Avatar: () => <span /> }));
vi.mock("@/features/presence/components/presence-summary/presence-summary", () => ({
  PresenceSummary: () => <span>Online</span>,
}));
vi.mock("@/features/friends", () => ({
  FriendConversationActions: ({ className }: { className?: string }) => (
    <button type="button" className={className}>
      More actions for Sam Okafor
    </button>
  ),
}));
vi.mock("@/features/calls", () => ({
  CallEntryAction: ({ label, recipientName }: { label: string; recipientName: string }) => (
    <div>
      <button type="button">{label}</button>
      <button type="button">Video call {recipientName}</button>
    </div>
  ),
}));

import FriendDetailPage from "./page";

describe("FriendDetailPage", () => {
  beforeEach(() => {
    getFriendDetailDataMock.mockResolvedValue({
      role: "client",
      userId: "client-1",
      friend: {
        friendshipId: "friendship-1",
        since: "2026-07-01T00:00:00.000Z",
        friend: {
          id: "client-2",
          displayName: "Sam Okafor",
          username: "sam_okafor",
          avatarUrl: null,
        },
      },
      conversationId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("offers audio and video calls for an accepted friend", async () => {
    render(await FriendDetailPage({ params: Promise.resolve({ id: "client-2" }) }));

    expect(screen.getByRole("button", { name: "Audio call" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Video call Sam Okafor" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "More actions for Sam Okafor" })
    ).toHaveClass("-mr-sm");
    expect(screen.getByRole("link", { name: "Friends" })).toHaveClass(
      "-ml-md"
    );
    expect(screen.queryByRole("button", { name: "Unfriend" })).toBeNull();
    expect(screen.getByRole("link", { name: "Message Sam Okafor" })).toHaveAttribute(
      "href",
      "/messages/11111111-1111-4111-8111-111111111111"
    );
  });
});
