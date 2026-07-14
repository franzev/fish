import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolvedService } from "@/lib/services/testing";
import type {
  FriendListItem,
  FriendRealtimeEvent,
  FriendRealtimeService,
  FriendRepository,
} from "@/lib/services";
import { FriendsScreen } from "./friends-screen";

const sam: FriendListItem = {
  friendshipId: "f-1",
  friend: { id: "user-sam", displayName: "Sam Lee", username: "sam_lee" },
  since: "2026-07-01T00:00:00Z",
};

const noor: FriendListItem = {
  friendshipId: "f-2",
  friend: { id: "user-noor", displayName: "Noor Aziz", username: "noor_a" },
  since: "2026-07-02T00:00:00Z",
};

function makeRepository(
  friendsPages: FriendListItem[][],
  incomingCount = 0
): FriendRepository {
  let call = 0;
  return {
    searchCandidate: vi.fn(),
    listFriends: vi.fn(() => {
      const page = friendsPages[Math.min(call, friendsPages.length - 1)];
      call += 1;
      return resolvedService({ friends: page, nextCursor: null });
    }),
    listIncomingRequests: vi.fn(() =>
      resolvedService({
        requests: Array.from({ length: incomingCount }, (_, index) => ({
          requestId: `req-${index}`,
          sender: sam.friend,
          createdAt: sam.since,
        })),
        nextCursor: null,
      })
    ),
    getIncomingRequest: vi.fn(() => resolvedService(null)),
    countIncomingRequests: vi.fn(() => resolvedService(incomingCount)),
    listNotifications: vi.fn(() => resolvedService([])),
    listBlockedUsers: vi.fn(() => resolvedService([])),
  };
}

function makeRealtime() {
  let handler: ((event: FriendRealtimeEvent) => void) | null = null;
  const service: FriendRealtimeService = {
    subscribe: vi.fn((_userId, onEvent) => {
      handler = onEvent;
      return vi.fn();
    }),
  };
  return {
    service,
    emit(event: FriendRealtimeEvent) {
      handler?.(event);
    },
  };
}

describe("FriendsScreen", () => {
  it("lists friends as navigable rows with one primary add action", () => {
    render(
      <FriendsScreen
        userId="me"
        initialFriends={[sam]}
        initialNextCursor={null}
        initialIncomingRequestCount={0}
        repository={makeRepository([[sam]])}
        realtime={makeRealtime().service}
      />
    );

    expect(screen.getByRole("link", { name: /Sam Lee/ })).toHaveAttribute(
      "href",
      "/friends/user-sam"
    );
    expect(screen.getByRole("link", { name: "Add a friend" })).toHaveAttribute(
      "href",
      "/friends/add"
    );
    expect(screen.getByRole("link", { name: "Blocked people" })).toHaveAttribute(
      "href",
      "/friends/blocked"
    );
  });

  it("shows a quiet marker when a request is waiting", () => {
    render(
      <FriendsScreen
        userId="me"
        initialFriends={[]}
        initialNextCursor={null}
        initialIncomingRequestCount={1}
        repository={makeRepository([[]], 1)}
        realtime={makeRealtime().service}
      />
    );

    expect(
      screen.getByRole("link", { name: /A friend request is waiting/ })
    ).toHaveAttribute("href", "/friends/requests");
  });

  it("refetches canonical state when a realtime hint arrives", async () => {
    const realtime = makeRealtime();
    const repository = makeRepository([[sam, noor]]);
    render(
      <FriendsScreen
        userId="me"
        initialFriends={[sam]}
        initialNextCursor={null}
        initialIncomingRequestCount={0}
        repository={repository}
        realtime={realtime.service}
      />
    );

    expect(screen.queryByText("Noor Aziz")).toBeNull();

    act(() => {
      realtime.emit({
        friendshipId: "f-2",
        reason: "friendship_created",
        occurredAt: "2026-07-12T00:00:00Z",
      });
    });

    expect(await screen.findByText("Noor Aziz")).toBeVisible();
    expect(repository.listFriends).toHaveBeenCalled();
  });

});
