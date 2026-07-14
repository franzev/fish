import type {
  FriendListItem,
  FriendProfile,
  IncomingFriendRequest,
} from "@/lib/services";
import type { UserRole } from "@fish/core/roles";

export interface FriendsPageData {
  role: UserRole;
  userId: string;
  friends: FriendListItem[];
  nextCursor: { createdAt: string; id: string } | null;
  incomingRequestCount: number;
}

export interface AddFriendPageData {
  role: UserRole;
  userId: string;
}

export interface FriendRequestsPageData {
  role: UserRole;
  userId: string;
  requests: IncomingFriendRequest[];
  nextCursor: { createdAt: string; id: string } | null;
}

export interface FriendRequestDetailData {
  role: UserRole;
  userId: string;
  request: IncomingFriendRequest | null;
}

export interface FriendDetailData {
  role: UserRole;
  userId: string;
  friend: FriendListItem | null;
  conversationId: string | null;
}

export interface BlockedPeoplePageData {
  role: UserRole;
  userId: string;
  blockedPeople: FriendProfile[];
}
