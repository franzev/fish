import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ClientFriendRequest,
  FriendCandidate,
  FriendCommandService,
  FriendRepository,
} from "@/lib/services";
import {
  MemberProfilePopover,
  type CommunityMemberProfile,
} from "./member-profile-popover";

const viewer: CommunityMemberProfile = {
  id: "client-franz",
  displayName: "Franz Eva",
  username: "franz_eva",
  role: "client",
};

const member: CommunityMemberProfile = {
  id: "client-sam",
  displayName: "Sam Okafor",
  username: "sam_okafor",
  role: "client",
};

const pendingRequest: ClientFriendRequest = {
  id: "request-1",
  senderId: viewer.id,
  recipientId: member.id,
  status: "pending",
  createdAt: "2026-07-14T01:00:00.000Z",
  updatedAt: "2026-07-14T01:00:00.000Z",
  respondedAt: null,
};

function friendCandidate(
  status: FriendCandidate["status"],
  requestId: string | null = null
): FriendCandidate {
  return {
    status,
    requestId,
    profile: status === "unavailable"
      ? null
      : {
          id: member.id,
          displayName: member.displayName,
          username: member.username ?? "sam_okafor",
        },
  };
}

function makeRepository(
  candidate: FriendCandidate = friendCandidate("none")
) {
  const searchCandidate = vi.fn(async () => ({
    ok: true as const,
    data: candidate,
  }));
  const repository = {
    searchCandidate,
    listFriends: vi.fn(),
    listIncomingRequests: vi.fn(),
    getIncomingRequest: vi.fn(),
    countIncomingRequests: vi.fn(),
    listNotifications: vi.fn(),
    listBlockedUsers: vi.fn(),
  } as unknown as FriendRepository;
  return { repository, searchCandidate };
}

function makeCommands(overrides: Partial<FriendCommandService> = {}) {
  return {
    sendRequest: vi.fn(async () => ({ ok: true as const, data: pendingRequest })),
    respondRequest: vi.fn(),
    cancelRequest: vi.fn(),
    removeFriend: vi.fn(),
    blockUser: vi.fn(async () => ({ ok: true as const, data: undefined })),
    unblockUser: vi.fn(),
    markNotificationsRead: vi.fn(),
    ...overrides,
  } as FriendCommandService;
}

function renderPopover({
  target = member,
  currentUser = viewer,
  friendActionsEnabled = true,
  trigger = "name" as const,
  repository = makeRepository().repository,
  commands = makeCommands(),
}: {
  target?: CommunityMemberProfile;
  currentUser?: CommunityMemberProfile;
  friendActionsEnabled?: boolean;
  trigger?: "avatar" | "name";
  repository?: FriendRepository;
  commands?: FriendCommandService;
} = {}) {
  render(
    <MemberProfilePopover
      member={target}
      currentUserId={currentUser.id}
      currentUserRole={currentUser.role}
      friendActionsEnabled={friendActionsEnabled}
      trigger={trigger}
      repository={repository}
      commands={commands}
    />
  );
  const triggerButton = screen.getByRole("button", {
    name: `View ${target.displayName} profile`,
  });
  fireEvent.click(triggerButton);
  return { triggerButton };
}

describe("MemberProfilePopover", () => {
  it("opens from an avatar and returns focus after closing", async () => {
    const { triggerButton } = renderPopover({
      target: viewer,
      currentUser: viewer,
      trigger: "avatar",
    });

    expect(
      await screen.findByRole("dialog", { name: viewer.displayName })
    ).toBeVisible();
    expect(screen.getByText(`@${viewer.username}`)).toBeVisible();
    expect(screen.getByText("Community member")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /More actions/ })
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: `Close ${viewer.displayName} profile` })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: viewer.displayName })).toBeNull()
    );
    expect(triggerButton).toHaveFocus();
  });

  it("opens from the author name and closes with Escape", async () => {
    renderPopover();
    expect(
      await screen.findByRole("dialog", { name: member.displayName })
    ).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: member.displayName })).toBeNull()
    );
  });

  it("fails closed when friend actions are disabled", async () => {
    const { repository, searchCandidate } = makeRepository();
    renderPopover({ friendActionsEnabled: false, repository });

    expect(
      await screen.findByRole("dialog", { name: member.displayName })
    ).toBeVisible();
    expect(searchCandidate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /More actions/ })
    ).toBeNull();
  });

  it("keeps coach-related previews informational", async () => {
    const coach = {
      ...member,
      id: "gwyn",
      displayName: "Gwyn",
      username: "gwyn",
      role: "coach" as const,
    };
    const { repository, searchCandidate } = makeRepository();
    renderPopover({ target: coach, repository });

    expect(await screen.findByRole("dialog", { name: coach.displayName })).toBeVisible();
    expect(screen.getByText("Coach")).toBeVisible();
    expect(searchCandidate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("keeps previews informational for coach viewers", async () => {
    const coachViewer = {
      ...viewer,
      id: "coach-viewer",
      displayName: "Coach Viewer",
      role: "coach" as const,
    };
    const { repository, searchCandidate } = makeRepository();
    renderPopover({ currentUser: coachViewer, repository });

    expect(
      await screen.findByRole("dialog", { name: member.displayName })
    ).toBeVisible();
    expect(searchCandidate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
  });

  it.each([
    ["outgoingPending", null, "Request sent", null],
    ["incomingPending", "request-9", "Review request", "/friends/requests/request-9"],
    ["friends", null, "Friends", null],
  ] as const)(
    "renders the %s relationship state",
    async (status, requestId, label, href) => {
      const { repository } = makeRepository(friendCandidate(status, requestId));
      renderPopover({ repository });

      const item = await screen.findByText(label);
      expect(item).toBeVisible();
      if (href) expect(item).toHaveAttribute("href", href);
    }
  );

  it("keeps unavailable people indistinguishable while retaining contact blocking", async () => {
    const { repository } = makeRepository(friendCandidate("unavailable"));
    renderPopover({ repository });

    await waitFor(() =>
      expect(screen.queryByText("Checking friend status…")).toBeNull()
    );
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
    expect(
      screen.getByRole("button", { name: `More actions for ${member.displayName}` })
    ).toBeVisible();
  });

  it("shows calm guidance when relationship lookup rejects", async () => {
    const repository = {
      ...makeRepository().repository,
      searchCandidate: vi.fn(async () => { throw new Error("offline"); }),
    } as FriendRepository;
    renderPopover({ repository });

    expect(await screen.findByText(
      "Friend status isn’t available yet. Give it a moment and try again."
    )).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("reuses one request id across a calm retry", async () => {
    const { repository } = makeRepository(friendCandidate("none"));
    const sendRequest = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        code: "friends_unavailable",
        notice: "That request did not send yet. Try again.",
      })
      .mockResolvedValueOnce({ ok: true as const, data: pendingRequest });
    renderPopover({
      repository,
      commands: makeCommands({ sendRequest }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Add friend" }));
    expect(
      await screen.findByText("That request did not send yet. Try again.")
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));

    expect(await screen.findByText("Request sent")).toBeVisible();
    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(sendRequest.mock.calls[0]?.[0].clientRequestId).toBe(
      sendRequest.mock.calls[1]?.[0].clientRequestId
    );
  });

  it("recovers when an incoming request races the add action", async () => {
    const initial = friendCandidate("none");
    const incoming = friendCandidate("incomingPending", "request-10");
    const searchCandidate = vi
      .fn()
      .mockResolvedValueOnce({ ok: true as const, data: initial })
      .mockResolvedValueOnce({ ok: true as const, data: incoming });
    const repository = {
      ...makeRepository().repository,
      searchCandidate,
    } as FriendRepository;
    const sendRequest = vi.fn(async () => ({
      ok: false as const,
      code: "incoming_request_exists",
      notice: "They already sent you a request.",
    }));
    renderPopover({
      repository,
      commands: makeCommands({ sendRequest }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Add friend" }));

    const review = await screen.findByRole("link", { name: "Review request" });
    expect(review).toHaveAttribute("href", "/friends/requests/request-10");
    expect(searchCandidate).toHaveBeenCalledTimes(2);
  });

  it("keeps the add action available when its command rejects", async () => {
    const { repository } = makeRepository(friendCandidate("none"));
    renderPopover({
      repository,
      commands: makeCommands({
        sendRequest: vi.fn(async () => { throw new Error("offline"); }),
      }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Add friend" }));

    expect(await screen.findByText(
      "That friend request didn’t send yet. Try again."
    )).toBeVisible();
    expect(screen.getByRole("button", { name: "Add friend" })).toBeEnabled();
  });

  it.each([
    ["request_pending", "Request sent"],
    ["already_friends", "Friends"],
  ] as const)("reconciles a %s command race", async (code, statusLabel) => {
    const { repository } = makeRepository(friendCandidate("none"));
    const sendRequest = vi.fn(async () => ({
      ok: false as const,
      code,
      notice: "Friend status changed while this request was sending.",
    }));
    renderPopover({
      repository,
      commands: makeCommands({ sendRequest }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Add friend" }));

    expect(await screen.findByText(statusLabel)).toBeVisible();
  });

  it("blocks only after truthful inline confirmation", async () => {
    const { repository } = makeRepository(friendCandidate("friends"));
    const blockUser = vi.fn(async () => ({
      ok: true as const,
      data: undefined,
    }));
    renderPopover({
      repository,
      commands: makeCommands({ blockUser }),
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: `More actions for ${member.displayName}`,
      })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Block member" }));

    expect(blockUser).not.toHaveBeenCalled();
    expect(
      screen.getByText(/won’t be able to find you or send friend requests/i)
    ).toBeVisible();
    expect(screen.getByText(/Any friendship will be removed/i)).toBeVisible();
    expect(screen.getByText(/still see each other’s community messages/i)).toBeVisible();
    expect(screen.getByText(/they won’t be told/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Block$/ }));

    await waitFor(() => expect(blockUser).toHaveBeenCalledWith(member.id));
    expect(
      await screen.findByText(/is blocked\. You’ll still see each other’s messages/i)
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: `Close ${member.displayName} profile` })
    ).toHaveFocus();
  });

  it("keeps the confirmation available when blocking fails", async () => {
    const { repository } = makeRepository(friendCandidate("friends"));
    const blockUser = vi.fn(async () => ({
      ok: false as const,
      code: "friends_unavailable",
      notice: "That block did not save yet. Try again.",
    }));
    renderPopover({
      repository,
      commands: makeCommands({ blockUser }),
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: `More actions for ${member.displayName}`,
      })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Block member" }));
    fireEvent.click(screen.getByRole("button", { name: /^Block$/ }));

    expect(
      await screen.findByText("That block did not save yet. Try again.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /^Block$/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Go back" })).toBeVisible();
  });

  it("keeps the confirmation available when blocking rejects", async () => {
    const { repository } = makeRepository(friendCandidate("friends"));
    renderPopover({
      repository,
      commands: makeCommands({
        blockUser: vi.fn(async () => { throw new Error("offline"); }),
      }),
    });

    fireEvent.click(await screen.findByRole("button", {
      name: `More actions for ${member.displayName}`,
    }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Block member" }));
    fireEvent.click(screen.getByRole("button", { name: /^Block$/ }));

    expect(await screen.findByText("That member wasn’t blocked yet. Try again."))
      .toBeVisible();
    expect(screen.getByRole("button", { name: /^Block$/ })).toBeEnabled();
  });
});
