import type { ServiceResult } from "../errors";

export interface FriendProfile {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
}
export type FriendRelationshipStatus = "none" | "outgoingPending" | "incomingPending" | "friends" | "unavailable";
export interface FriendCandidate { status: FriendRelationshipStatus; profile: FriendProfile | null; requestId: string | null }
export interface FriendListItem { friendshipId: string; friend: FriendProfile; since: string }
export interface FriendListPage { friends: FriendListItem[]; nextCursor: { createdAt: string; id: string } | null }
export interface IncomingFriendRequest { requestId: string; sender: FriendProfile; createdAt: string }
export interface IncomingFriendRequestPage { requests: IncomingFriendRequest[]; nextCursor: { createdAt: string; id: string } | null }
export type FriendNotificationKind = "friendRequestReceived" | "friendRequestAccepted";
export interface FriendNotification {
  id: string;
  kind: FriendNotificationKind;
  actor: FriendProfile;
  entityId: string;
  readAt: string | null;
  createdAt: string;
}
export interface FriendRepository {
  searchCandidate(username: string): Promise<ServiceResult<FriendCandidate>>;
  listFriends(cursor?: { createdAt: string; id: string } | null): Promise<ServiceResult<FriendListPage>>;
  listIncomingRequests(cursor?: { createdAt: string; id: string } | null): Promise<ServiceResult<IncomingFriendRequestPage>>;
  getIncomingRequest(requestId: string): Promise<ServiceResult<IncomingFriendRequest | null>>;
  countIncomingRequests(): Promise<ServiceResult<number>>;
  listNotifications(): Promise<ServiceResult<FriendNotification[]>>;
  listBlockedUsers(): Promise<ServiceResult<FriendProfile[]>>;
}
export type FriendRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export interface ClientFriendRequest {
  id: string;
  senderId: string;
  recipientId: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
}
export type FriendCommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; notice: string };
export interface FriendCommandService {
  sendRequest(input: { targetId: string; clientRequestId: string }): Promise<FriendCommandResult<ClientFriendRequest>>;
  respondRequest(input: { requestId: string; response: "accept" | "decline" }): Promise<FriendCommandResult<ClientFriendRequest>>;
  cancelRequest(requestId: string): Promise<FriendCommandResult<ClientFriendRequest>>;
  removeFriend(targetId: string): Promise<FriendCommandResult<void>>;
  blockUser(targetId: string): Promise<FriendCommandResult<void>>;
  unblockUser(targetId: string): Promise<FriendCommandResult<void>>;
  markNotificationsRead(notificationIds: string[]): Promise<FriendCommandResult<number>>;
}
export interface FriendRealtimeEvent { requestId?: string; friendshipId?: string; reason: string; occurredAt: string }
export interface FriendRealtimeService {
  subscribe(userId: string, onEvent: (event: FriendRealtimeEvent) => void, onRecovery?: () => void): () => void;
}
