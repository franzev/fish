import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ClientFriendRequest,
  FriendCommandService,
  IncomingFriendRequest,
} from "@/lib/services";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { FriendRequestReview } from "./friend-request-review";

const request: IncomingFriendRequest = {
  requestId: "req-1",
  sender: { id: "user-sam", displayName: "Sam Lee", username: "sam_lee" },
  createdAt: "2026-07-10T00:00:00Z",
};

const acceptedRequest: ClientFriendRequest = {
  id: "req-1",
  senderId: "user-sam",
  recipientId: "me",
  status: "accepted",
  createdAt: "2026-07-10T00:00:00Z",
  updatedAt: "2026-07-12T00:00:00Z",
  respondedAt: "2026-07-12T00:00:00Z",
};

function makeCommands(
  overrides: Partial<FriendCommandService> = {}
): FriendCommandService {
  return {
    sendRequest: vi.fn(),
    respondRequest: vi.fn(async () => ({
      ok: true as const,
      data: acceptedRequest,
    })),
    cancelRequest: vi.fn(),
    removeFriend: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    markNotificationsRead: vi.fn(),
    ...overrides,
  } as FriendCommandService;
}

describe("FriendRequestReview", () => {
  it("accepts with the single primary action and lands on friends", async () => {
    pushMock.mockClear();
    const commands = makeCommands();
    render(<FriendRequestReview request={request} commands={commands} />);

    fireEvent.click(screen.getByRole("button", { name: "Accept request" }));

    await waitFor(() =>
      expect(commands.respondRequest).toHaveBeenCalledWith({
        requestId: "req-1",
        response: "accept",
      })
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/friends"));
  });

  it("declines quietly and returns to the request list", async () => {
    pushMock.mockClear();
    const commands = makeCommands();
    render(<FriendRequestReview request={request} commands={commands} />);

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() =>
      expect(commands.respondRequest).toHaveBeenCalledWith({
        requestId: "req-1",
        response: "decline",
      })
    );
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/friends/requests")
    );
  });

  it("stays put with a calm notice when the request was already resolved", async () => {
    pushMock.mockClear();
    const commands = makeCommands({
      respondRequest: vi.fn(async () => ({
        ok: false as const,
        code: "request_already_resolved",
        notice: "This request was already handled.",
      })),
    });
    render(<FriendRequestReview request={request} commands={commands} />);

    fireEvent.click(screen.getByRole("button", { name: "Accept request" }));

    expect(
      await screen.findByText("This request was already handled.")
    ).toBeVisible();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
