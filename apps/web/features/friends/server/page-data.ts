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

async function avatarMap(services: AppServices, profileIds: string[]) {
  if (!services.avatars) return new Map<string, string>();
  const items = await services.avatars.resolveUrls(profileIds);
  return new Map(items.map((item) => [item.profileId, item.url]));
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

  const [friendsResult, requestCountResult, notificationsResult] =
    await Promise.all([
      services.database.friends.listFriends(),
      services.database.friends.countIncomingRequests(),
      services.database.friends.listNotifications(),
    ]);
  if (!friendsResult.ok) throw friendsResult.error;
  if (!requestCountResult.ok) throw requestCountResult.error;
  if (!notificationsResult.ok) throw notificationsResult.error;

  const urls = await avatarMap(services, [
    ...friendsResult.data.friends.map((item) => item.friend.id),
    ...notificationsResult.data.map((item) => item.actor.id),
  ]);

  return {
    role: profile.role,
    userId: profile.userId,
    friends: friendsResult.data.friends.map((item) => ({
      ...item,
      friend: { ...item.friend, avatarUrl: urls.get(item.friend.id) ?? null },
    })),
    nextCursor: friendsResult.data.nextCursor,
    incomingRequestCount: requestCountResult.data,
    acceptedNotifications: notificationsResult.data.filter(
      (notification) =>
        notification.kind === "friendRequestAccepted" &&
        notification.readAt === null
    ).map((notification) => ({
      ...notification,
      actor: {
        ...notification.actor,
        avatarUrl: urls.get(notification.actor.id) ?? null,
      },
    })),
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
    return {
      role: profile.role,
      userId: profile.userId,
      requests: [],
      nextCursor: null,
    };
  }

  const requestsResult = await services.database.friends.listIncomingRequests();
  if (!requestsResult.ok) throw requestsResult.error;
  const urls = await avatarMap(
    services,
    requestsResult.data.requests.map((request) => request.sender.id)
  );
  return {
    role: profile.role,
    userId: profile.userId,
    requests: requestsResult.data.requests.map((request) => ({
      ...request,
      sender: { ...request.sender, avatarUrl: urls.get(request.sender.id) ?? null },
    })),
    nextCursor: requestsResult.data.nextCursor,
  };
}

export async function getFriendRequestDetailData(
  requestId: string,
  injected?: AppServices
): Promise<FriendRequestDetailData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await getCurrentProfile(profileDependencies(services));
  if (!profile) return null;

  if (profile.role !== "client") {
    return { role: profile.role, userId: profile.userId, request: null };
  }

  const result = await services.database.friends.getIncomingRequest(requestId);
  if (!result.ok) throw result.error;
  const request = result.data;
  const url = request && services.avatars
    ? (await services.avatars.resolveUrls([request.sender.id]))[0]?.url ?? null
    : null;
  return {
    role: profile.role,
    userId: profile.userId,
    request: request
      ? { ...request, sender: { ...request.sender, avatarUrl: url } }
      : null,
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

  if (friend) {
    const url = services.avatars
      ? (await services.avatars.resolveUrls([friend.friend.id]))[0]?.url ?? null
      : null;
    friend = { ...friend, friend: { ...friend.friend, avatarUrl: url } };
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
