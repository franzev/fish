import "server-only";

import { getServerServices } from "@/lib/services/runtime/server";
import type { AppServices, FriendListItem } from "@/lib/services";
import { getCurrentProfile } from "@/features/auth/server";
import type {
  AddFriendPageData,
  BlockedPeoplePageData,
  FriendDetailData,
  FriendRequestDetailData,
  FriendRequestsPageData,
  FriendsPageData,
} from "../contracts";

/* Presentation gate only; the database independently enforces the same
   fail-closed rollout at the RPC boundary. */
export function friendsFeatureEnabled(): boolean {
  return process.env.FRIENDS_ENABLED?.trim().toLowerCase() === "true";
}

function profileDependencies(services: AppServices) {
  return { auth: services.auth, profiles: services.database.profiles };
}

export async function getFriendsPageData(
  injected?: AppServices
): Promise<FriendsPageData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(profileDependencies(services));
  if (!profile) return null;

  if (profile.role !== "client") {
    return {
      role: profile.role,
      userId: profile.userId,
      friends: [],
      nextCursor: null,
      incomingRequestCount: 0,
      acceptedNotifications: [],
    };
  }

  const [friendsResult, requestsResult, notificationsResult] =
    await Promise.all([
      services.database.friends.listFriends(),
      services.database.friends.listIncomingRequests(),
      services.database.friends.listNotifications(),
    ]);
  if (!friendsResult.ok) throw friendsResult.error;
  if (!requestsResult.ok) throw requestsResult.error;
  if (!notificationsResult.ok) throw notificationsResult.error;

  return {
    role: profile.role,
    userId: profile.userId,
    friends: friendsResult.data.friends,
    nextCursor: friendsResult.data.nextCursor,
    incomingRequestCount: requestsResult.data.length,
    acceptedNotifications: notificationsResult.data.filter(
      (notification) =>
        notification.kind === "friendRequestAccepted" &&
        notification.readAt === null
    ),
  };
}

export async function getAddFriendPageData(
  injected?: AppServices
): Promise<AddFriendPageData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(profileDependencies(services));
  if (!profile) return null;
  return { role: profile.role, userId: profile.userId };
}

export async function getFriendRequestsPageData(
  injected?: AppServices
): Promise<FriendRequestsPageData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(profileDependencies(services));
  if (!profile) return null;

  if (profile.role !== "client") {
    return { role: profile.role, userId: profile.userId, requests: [] };
  }

  const requestsResult = await services.database.friends.listIncomingRequests();
  if (!requestsResult.ok) throw requestsResult.error;
  return {
    role: profile.role,
    userId: profile.userId,
    requests: requestsResult.data,
  };
}

export async function getFriendRequestDetailData(
  requestId: string,
  injected?: AppServices
): Promise<FriendRequestDetailData | null> {
  // The incoming list RPC caps at 100 pending requests; with senders limited
  // to 25 outstanding each this holds comfortably at pilot scale.
  const data = await getFriendRequestsPageData(injected);
  if (!data) return null;
  return {
    role: data.role,
    userId: data.userId,
    request:
      data.requests.find((request) => request.requestId === requestId) ?? null,
  };
}

export async function getFriendDetailData(
  friendId: string,
  injected?: AppServices
): Promise<FriendDetailData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(profileDependencies(services));
  if (!profile) return null;

  if (profile.role !== "client") {
    return { role: profile.role, userId: profile.userId, friend: null };
  }

  let friend: FriendListItem | null = null;
  let cursor: { createdAt: string; id: string } | null = null;
  // Bounded page walk; friends lists stay small, this is not a hot path.
  for (let page = 0; page < 20; page += 1) {
    const result = await services.database.friends.listFriends(cursor);
    if (!result.ok) throw result.error;
    friend = result.data.friends.find(
      (item) => item.friend.id === friendId
    ) ?? null;
    if (friend || !result.data.nextCursor) break;
    cursor = result.data.nextCursor;
  }

  return { role: profile.role, userId: profile.userId, friend };
}

export async function getBlockedPeoplePageData(
  injected?: AppServices
): Promise<BlockedPeoplePageData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(profileDependencies(services));
  if (!profile) return null;

  if (profile.role !== "client") {
    return { role: profile.role, userId: profile.userId, blockedPeople: [] };
  }

  const result = await services.database.friends.listBlockedUsers();
  if (!result.ok) throw result.error;
  return {
    role: profile.role,
    userId: profile.userId,
    blockedPeople: result.data,
  };
}
