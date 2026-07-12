import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolvedService } from "@/lib/services/testing";
import type {
  FriendRealtimeEvent,
  FriendRealtimeService,
  FriendRepository,
  IncomingFriendRequest,
} from "@/lib/services";
import { FriendRequestsList } from "./friend-requests-list";

const request: IncomingFriendRequest = {
  requestId: "req-1",
  sender: { id: "user-sam", displayName: "Sam Lee", username: "sam_lee" },
  createdAt: "2026-07-10T00:00:00Z",
};

function makeRepository(pages: IncomingFriendRequest[][]): FriendRepository {
  let call = 0;
  return {
    searchCandidate: vi.fn(),
    listFriends: vi.fn(),
    listIncomingRequests: vi.fn(() => {
      const page = pages[Math.min(call, pages.length - 1)];
      call += 1;
      return resolvedService(page);
    }),
    listNotifications: vi.fn(() => resolvedService([])),
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

describe("FriendRequestsList", () => {
  it("renders requests as navigable rows without primary buttons", () => {
    render(
      <FriendRequestsList
        userId="me"
        initialRequests={[request]}
        repository={makeRepository([[request]])}
        realtime={makeRealtime().service}
      />
    );

    expect(screen.getByRole("link", { name: /Sam Lee/ })).toHaveAttribute(
      "href",
      "/friends/requests/req-1"
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a calm empty state", () => {
    render(
      <FriendRequestsList
        userId="me"
        initialRequests={[]}
        repository={makeRepository([[]])}
        realtime={makeRealtime().service}
      />
    );

    expect(
      screen.getByText("No requests right now. New ones will appear here.")
    ).toBeVisible();
  });

  it("drops a request quietly after a realtime hint", async () => {
    const realtime = makeRealtime();
    render(
      <FriendRequestsList
        userId="me"
        initialRequests={[request]}
        repository={makeRepository([[]])}
        realtime={realtime.service}
      />
    );

    act(() => {
      realtime.emit({
        requestId: "req-1",
        reason: "request_cancelled",
        occurredAt: "2026-07-12T00:00:00Z",
      });
    });

    expect(
      await screen.findByText("No requests right now. New ones will appear here.")
    ).toBeVisible();
  });
});
