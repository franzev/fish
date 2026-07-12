import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolvedService } from "@/lib/services/testing";
import type {
  FriendCommandService,
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
      resolvedService(
        Array.from({ length: incomingCount }, (_, index) => ({
          requestId: `req-${index}`,
          sender: sam.friend,
          createdAt: sam.since,
        }))
      )
    ),
    listNotifications: vi.fn(() => resolvedService([])),
  };
}

function makeCommands(): FriendCommandService {
  return {
    sendRequest: vi.fn(),
    respondRequest: vi.fn(),
    cancelRequest: vi.fn(),
    removeFriend: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    markNotificationsRead: vi.fn(async () => ({ ok: true as const, data: 1 })),
  } as FriendCommandService;
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
        initialAcceptedNotifications={[]}
        repository={makeRepository([[sam]])}
        commands={makeCommands()}
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
  });

  it("shows a quiet marker when a request is waiting", () => {
    render(
      <FriendsScreen
        userId="me"
        initialFriends={[]}
        initialNextCursor={null}
        initialIncomingRequestCount={1}
        initialAcceptedNotifications={[]}
        repository={makeRepository([[]], 1)}
        commands={makeCommands()}
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
        initialAcceptedNotifications={[]}
        repository={repository}
        commands={makeCommands()}
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

  it("shows accepted notes and quietly marks them read once", async () => {
    const commands = makeCommands();
    render(
      <FriendsScreen
        userId="me"
        initialFriends={[sam]}
        initialNextCursor={null}
        initialIncomingRequestCount={0}
        initialAcceptedNotifications={[
          {
            id: "n-1",
            kind: "friendRequestAccepted",
            actor: sam.friend,
            entityId: "req-1",
            readAt: null,
            createdAt: sam.since,
          },
        ]}
        repository={makeRepository([[sam]])}
        commands={commands}
        realtime={makeRealtime().service}
      />
    );

    expect(
      screen.getByText("Sam Lee accepted your friend request.")
    ).toBeVisible();
    await waitFor(() =>
      expect(commands.markNotificationsRead).toHaveBeenCalledWith(["n-1"])
    );
    expect(commands.markNotificationsRead).toHaveBeenCalledTimes(1);
  });
});
