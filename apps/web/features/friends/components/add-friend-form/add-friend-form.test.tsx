import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolvedService } from "@/lib/services/testing";
import type {
  FriendCandidate,
  FriendCommandService,
  FriendRepository,
} from "@/lib/services";
import { AddFriendForm } from "./add-friend-form";

function makeRepository(candidate: FriendCandidate): FriendRepository {
  return {
    searchCandidate: vi.fn(() => resolvedService(candidate)),
    listFriends: vi.fn(() =>
      resolvedService({ friends: [], nextCursor: null })
    ),
    listIncomingRequests: vi.fn(() =>
      resolvedService({ requests: [], nextCursor: null })
    ),
    getIncomingRequest: vi.fn(() => resolvedService(null)),
    countIncomingRequests: vi.fn(() => resolvedService(0)),
    listNotifications: vi.fn(() => resolvedService([])),
    listBlockedUsers: vi.fn(() => resolvedService([])),
  };
}

function makeCommands(
  overrides: Partial<FriendCommandService> = {}
): FriendCommandService {
  return {
    sendRequest: vi.fn(async () => ({
      ok: true as const,
      data: {
        id: "req-1",
        senderId: "me",
        recipientId: "them",
        status: "pending" as const,
        createdAt: "2026-07-12T00:00:00Z",
        updatedAt: "2026-07-12T00:00:00Z",
        respondedAt: null,
      },
    })),
    respondRequest: vi.fn(),
    cancelRequest: vi.fn(),
    removeFriend: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    markNotificationsRead: vi.fn(),
    ...overrides,
  } as FriendCommandService;
}

const availableCandidate: FriendCandidate = {
  status: "none",
  profile: { id: "them", displayName: "Sam Lee", username: "sam_lee" },
  requestId: null,
};

async function searchFor(username: string) {
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: username },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
}

describe("AddFriendForm", () => {
  it("asks for a username before searching instead of erroring", async () => {
    const repository = makeRepository(availableCandidate);
    render(<AddFriendForm repository={repository} commands={makeCommands()} />);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Add a username to search.")).toBeVisible();
    expect(repository.searchCandidate).not.toHaveBeenCalled();
  });

  it("shows the found person with Add friend as the only primary action", async () => {
    const repository = makeRepository(availableCandidate);
    render(<AddFriendForm repository={repository} commands={makeCommands()} />);

    await searchFor("@Sam_Lee");

    expect(await screen.findByText("Sam Lee")).toBeVisible();
    expect(screen.getByText("@sam_lee")).toBeVisible();
    expect(repository.searchCandidate).toHaveBeenCalledWith("@Sam_Lee");
    expect(screen.getByRole("button", { name: "Add friend" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });

  it("sends the request once and settles into a calm sent state", async () => {
    const commands = makeCommands();
    render(
      <AddFriendForm
        repository={makeRepository(availableCandidate)}
        commands={commands}
      />
    );

    await searchFor("sam_lee");
    fireEvent.click(await screen.findByRole("button", { name: "Add friend" }));

    await waitFor(() =>
      expect(screen.getByText(/Request sent/)).toBeVisible()
    );
    expect(commands.sendRequest).toHaveBeenCalledTimes(1);
    const input = (commands.sendRequest as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(input.targetId).toBe("them");
    expect(input.clientRequestId).toEqual(expect.any(String));
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("keeps unknown and blocked people indistinguishable", async () => {
    render(
      <AddFriendForm
        repository={makeRepository({
          status: "unavailable",
          profile: null,
          requestId: null,
        })}
        commands={makeCommands()}
      />
    );

    await searchFor("nobody_here");

    expect(
      await screen.findByText(/That person isn’t available/)
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("guides a crossed request to review instead of re-sending", async () => {
    render(
      <AddFriendForm
        repository={makeRepository({
          status: "incomingPending",
          profile: availableCandidate.profile,
          requestId: "req-9",
        })}
        commands={makeCommands()}
      />
    );

    await searchFor("sam_lee");

    const review = await screen.findByRole("link", { name: "Review request" });
    expect(review).toHaveAttribute("href", "/friends/requests/req-9");
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("shows the already-friends state without an add action", async () => {
    render(
      <AddFriendForm
        repository={makeRepository({
          status: "friends",
          profile: availableCandidate.profile,
          requestId: null,
        })}
        commands={makeCommands()}
      />
    );

    await searchFor("sam_lee");

    expect(await screen.findByText(/already friends\./)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("recovers into review when a crossed request lands mid-send", async () => {
    const repository = makeRepository(availableCandidate);
    (repository.searchCandidate as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => resolvedService(availableCandidate))
      .mockImplementationOnce(() =>
        resolvedService({
          status: "incomingPending",
          profile: availableCandidate.profile,
          requestId: "req-9",
        })
      );
    const commands = makeCommands({
      sendRequest: vi.fn(async () => ({
        ok: false as const,
        code: "incoming_request_exists",
        notice: "They already sent you a request. Review it when you’re ready.",
      })),
    });
    render(<AddFriendForm repository={repository} commands={commands} />);

    await searchFor("sam_lee");
    fireEvent.click(await screen.findByRole("button", { name: "Add friend" }));

    const review = await screen.findByRole("link", { name: "Review request" });
    expect(review).toHaveAttribute("href", "/friends/requests/req-9");
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("relays the calm server notice when sending fails", async () => {
    const commands = makeCommands({
      sendRequest: vi.fn(async () => ({
        ok: false as const,
        code: "rate_limited",
        notice: "Pause for a moment before sending more requests.",
      })),
    });
    render(
      <AddFriendForm
        repository={makeRepository(availableCandidate)}
        commands={commands}
      />
    );

    await searchFor("sam_lee");
    fireEvent.click(await screen.findByRole("button", { name: "Add friend" }));

    expect(
      await screen.findByText("Pause for a moment before sending more requests.")
    ).toBeVisible();
    // Still recoverable: the action stays available for a later retry.
    expect(screen.getByRole("button", { name: "Add friend" })).toBeVisible();
  });
});
