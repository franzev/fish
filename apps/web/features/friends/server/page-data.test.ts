import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.fn();
const findProfileByIdMock = vi.fn();
const listFriendsMock = vi.fn();
const listIncomingRequestsMock = vi.fn();
const listNotificationsMock = vi.fn();
const listBlockedUsersMock = vi.fn();
const searchCandidateMock = vi.fn();

vi.mock("@/lib/services/supabase/server", () => ({
  createServerSupabaseServices: async () => ({
    auth: { getCurrentUser: getCurrentUserMock },
    database: {
      profiles: { findById: findProfileByIdMock },
      friends: {
        searchCandidate: searchCandidateMock,
        listFriends: listFriendsMock,
        listIncomingRequests: listIncomingRequestsMock,
        listNotifications: listNotificationsMock,
        listBlockedUsers: listBlockedUsersMock,
      },
    },
  }),
}));

import {
  friendsFeatureEnabled,
  getBlockedPeoplePageData,
  getFriendDetailData,
  getFriendRequestDetailData,
  getFriendsPageData,
} from "./page-data";

const sam = { id: "user-sam", displayName: "Sam Lee", username: "sam_lee" };

function signedInAs(role: "client" | "coach") {
  getCurrentUserMock.mockResolvedValue({ ok: true, data: { id: "me" } });
  findProfileByIdMock.mockResolvedValue({
    ok: true,
    data: { role, displayName: "Alex Rivera" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  getCurrentUserMock.mockReset();
  findProfileByIdMock.mockReset();
  listFriendsMock.mockReset();
  listIncomingRequestsMock.mockReset();
  listNotificationsMock.mockReset();
  listBlockedUsersMock.mockReset();
  searchCandidateMock.mockReset();
});

describe("friendsFeatureEnabled", () => {
  it("stays off unless the pilot flag explicitly turns it on", () => {
    vi.stubEnv("FRIENDS_ENABLED", "");
    expect(friendsFeatureEnabled()).toBe(false);

    vi.stubEnv("FRIENDS_ENABLED", "false");
    expect(friendsFeatureEnabled()).toBe(false);

    vi.stubEnv("FRIENDS_ENABLED", "true");
    expect(friendsFeatureEnabled()).toBe(true);

    vi.stubEnv("FRIENDS_ENABLED", " TRUE ");
    expect(friendsFeatureEnabled()).toBe(true);
  });
});

describe("getFriendsPageData", () => {
  it("returns null when signed out", async () => {
    getCurrentUserMock.mockResolvedValue({ ok: true, data: null });
    expect(await getFriendsPageData()).toBeNull();
  });

  it("returns the wrong-door shape for coaches without touching friends data", async () => {
    signedInAs("coach");

    const data = await getFriendsPageData();

    expect(data).toEqual({
      role: "coach",
      userId: "me",
      friends: [],
      nextCursor: null,
      incomingRequestCount: 0,
      acceptedNotifications: [],
    });
    expect(listFriendsMock).not.toHaveBeenCalled();
  });

  it("aggregates friends, the request count, and only unread accepted notes", async () => {
    signedInAs("client");
    listFriendsMock.mockResolvedValue({
      ok: true,
      data: {
        friends: [{ friendshipId: "f-1", friend: sam, since: "2026-07-01" }],
        nextCursor: null,
      },
    });
    listIncomingRequestsMock.mockResolvedValue({
      ok: true,
      data: [{ requestId: "req-1", sender: sam, createdAt: "2026-07-10" }],
    });
    listNotificationsMock.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "n-1",
          kind: "friendRequestAccepted",
          actor: sam,
          entityId: "req-0",
          readAt: null,
          createdAt: "2026-07-11",
        },
        {
          id: "n-2",
          kind: "friendRequestAccepted",
          actor: sam,
          entityId: "req-x",
          readAt: "2026-07-11",
          createdAt: "2026-07-11",
        },
        {
          id: "n-3",
          kind: "friendRequestReceived",
          actor: sam,
          entityId: "req-1",
          readAt: null,
          createdAt: "2026-07-11",
        },
      ],
    });

    const data = await getFriendsPageData();

    expect(data?.friends).toHaveLength(1);
    expect(data?.incomingRequestCount).toBe(1);
    expect(data?.acceptedNotifications.map((n) => n.id)).toEqual(["n-1"]);
  });
});

describe("getFriendRequestDetailData", () => {
  it("finds the request by id and hides everything else", async () => {
    signedInAs("client");
    listIncomingRequestsMock.mockResolvedValue({
      ok: true,
      data: [
        { requestId: "req-1", sender: sam, createdAt: "2026-07-10" },
        {
          requestId: "req-2",
          sender: { ...sam, id: "user-noor" },
          createdAt: "2026-07-11",
        },
      ],
    });

    const found = await getFriendRequestDetailData("req-2");
    expect(found?.request?.requestId).toBe("req-2");

    const missing = await getFriendRequestDetailData("req-404");
    expect(missing?.request).toBeNull();
  });
});

describe("getFriendDetailData", () => {
  it("walks pages until the friend is found", async () => {
    signedInAs("client");
    const cursor = { createdAt: "2026-07-01", id: "f-1" };
    listFriendsMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          friends: [{ friendshipId: "f-1", friend: sam, since: "2026-07-01" }],
          nextCursor: cursor,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          friends: [
            {
              friendshipId: "f-2",
              friend: { ...sam, id: "user-noor", username: "noor_a" },
              since: "2026-06-01",
            },
          ],
          nextCursor: null,
        },
      });

    const data = await getFriendDetailData("user-noor");

    expect(data?.friend?.friendshipId).toBe("f-2");
    expect(listFriendsMock).toHaveBeenNthCalledWith(1, null);
    expect(listFriendsMock).toHaveBeenNthCalledWith(2, cursor);
  });

  it("returns null friend when no page contains the person", async () => {
    signedInAs("client");
    listFriendsMock.mockResolvedValue({
      ok: true,
      data: { friends: [], nextCursor: null },
    });

    const data = await getFriendDetailData("user-ghost");
    expect(data?.friend).toBeNull();
  });
});

describe("getBlockedPeoplePageData", () => {
  it("returns only the signed-in client's blocked people", async () => {
    signedInAs("client");
    listBlockedUsersMock.mockResolvedValue({ ok: true, data: [sam] });

    const data = await getBlockedPeoplePageData();

    expect(data?.blockedPeople).toEqual([sam]);
    expect(listBlockedUsersMock).toHaveBeenCalledTimes(1);
  });

  it("keeps coaches out without reading block data", async () => {
    signedInAs("coach");

    const data = await getBlockedPeoplePageData();

    expect(data?.blockedPeople).toEqual([]);
    expect(listBlockedUsersMock).not.toHaveBeenCalled();
  });
});
