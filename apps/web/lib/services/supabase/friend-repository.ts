import {
  serviceFailure,
  serviceSuccess,
  type ServiceResult,
} from "@/lib/services/errors";
import { mapSupabaseError, safely } from "./shared";
import type {
  FriendCandidate,
  FriendListPage,
  FriendNotification,
  FriendNotificationKind,
  FriendProfile,
  FriendRelationshipStatus,
  FriendRepository,
  IncomingFriendRequest,
} from "../contracts";
import type { AppSupabaseClient } from "./types";

const friendPageSize = 50;

type CandidatePayload = {
  status?: string;
  request_id?: string;
  profile?: {
    id?: string;
    display_name?: string;
    username?: string;
  };
};

const candidateStatusByRpcValue: Record<string, FriendRelationshipStatus> = {
  none: "none",
  outgoing_pending: "outgoingPending",
  incoming_pending: "incomingPending",
  friends: "friends",
  unavailable: "unavailable",
};

const notificationKindByRpcValue: Record<string, FriendNotificationKind> = {
  friend_request_received: "friendRequestReceived",
  friend_request_accepted: "friendRequestAccepted",
};

function toFriendProfile(
  value: CandidatePayload["profile"]
): FriendProfile | null {
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.display_name !== "string" ||
    typeof value.username !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    displayName: value.display_name,
    username: value.username,
  };
}

export class SupabaseFriendRepository implements FriendRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async searchCandidate(
    username: string
  ): Promise<ServiceResult<FriendCandidate>> {
    return safely("friends.searchCandidate", async () => {
      const { data, error } = await this.client.rpc("search_friend_candidate", {
        p_username: username,
      });

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not look up that username.",
            operation: "friends.searchCandidate",
            recoverable: true,
          })
        );
      }

      const payload = (data ?? {}) as CandidatePayload;
      const status = candidateStatusByRpcValue[payload.status ?? ""] ??
        "unavailable";
      const profile = toFriendProfile(payload.profile);
      return serviceSuccess({
        status: profile ? status : "unavailable",
        profile,
        requestId: typeof payload.request_id === "string"
          ? payload.request_id
          : null,
      });
    });
  }

  async listFriends(
    cursor?: { createdAt: string; id: string } | null
  ): Promise<ServiceResult<FriendListPage>> {
    return safely("friends.listFriends", async () => {
      const { data, error } = await this.client.rpc("list_friends", {
        p_limit: friendPageSize,
        ...(cursor
          ? { p_cursor_created_at: cursor.createdAt, p_cursor_id: cursor.id }
          : {}),
      });

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load your friends.",
            operation: "friends.listFriends",
            recoverable: true,
          })
        );
      }

      const rows = data ?? [];
      const last = rows.length === friendPageSize ? rows[rows.length - 1] : null;
      return serviceSuccess({
        friends: rows.map((row) => ({
          friendshipId: row.friendship_id,
          friend: {
            id: row.friend_id,
            displayName: row.display_name,
            username: row.username,
          },
          since: row.created_at,
        })),
        nextCursor: last
          ? { createdAt: last.created_at, id: last.friendship_id }
          : null,
      });
    });
  }

  async listIncomingRequests(): Promise<
    ServiceResult<IncomingFriendRequest[]>
  > {
    return safely("friends.listIncomingRequests", async () => {
      const { data, error } = await this.client.rpc(
        "list_incoming_friend_requests"
      );

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load friend requests.",
            operation: "friends.listIncomingRequests",
            recoverable: true,
          })
        );
      }

      return serviceSuccess(
        (data ?? []).map((row) => ({
          requestId: row.request_id,
          sender: {
            id: row.sender_id,
            displayName: row.display_name,
            username: row.username,
          },
          createdAt: row.created_at,
        }))
      );
    });
  }

  async listNotifications(): Promise<ServiceResult<FriendNotification[]>> {
    return safely("friends.listNotifications", async () => {
      const { data, error } = await this.client.rpc(
        "list_friend_notifications",
        {}
      );

      if (error) {
        return serviceFailure(
          mapSupabaseError(error, {
            code: "database",
            fallbackMessage: "Could not load notifications.",
            operation: "friends.listNotifications",
            recoverable: true,
          })
        );
      }

      const notifications: FriendNotification[] = [];
      for (const row of data ?? []) {
        const kind = notificationKindByRpcValue[row.kind];
        if (!kind) continue;
        notifications.push({
          id: row.id,
          kind,
          actor: {
            id: row.actor_id,
            displayName: row.actor_display_name,
            username: row.actor_username,
          },
          entityId: row.entity_id,
          readAt: row.read_at,
          createdAt: row.created_at,
        });
      }
      return serviceSuccess(notifications);
    });
  }
}
