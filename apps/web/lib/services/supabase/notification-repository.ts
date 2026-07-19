import type {
  NotificationCategory,
  NotificationChange,
  NotificationFilter,
  NotificationItem,
  NotificationKind,
  NotificationPage,
  NotificationSummary,
} from "@fish/core/notification-state";
import { serviceSuccess, type ServiceResult } from "@/lib/services/errors";
import type { NotificationRepository } from "../contracts";
import { failWith, safely } from "./shared";
import type { AppSupabaseClient } from "./types";

const defaultPageSize = 30;

const kindByDatabaseValue: Record<string, NotificationKind> = {
  friend_request_received: "friendRequestReceived",
  friend_request_accepted: "friendRequestAccepted",
  system_announcement: "systemAnnouncement",
  product_update: "productUpdate",
  moderation_action: "moderationAction",
  call_missed: "callMissed",
  call_completed: "callCompleted",
  message_mention: "messageMention",
  message_reply: "messageReply",
  message_reaction: "messageReaction",
};

const categoryByDatabaseValue: Record<string, NotificationCategory> = {
  action_required: "actionRequired",
  direct: "direct",
  update: "update",
};

function socialHref(row: {
  kind: string;
  action_href: string;
  channel_slug: string;
  conversation_id: string;
  message_id: string;
  call_id: string;
  friend_request_id: string;
  actor_id: string;
}): string | null {
  if (row.action_href) return row.action_href;
  if (row.channel_slug) {
    const focus = row.message_id
      ? `?message=${encodeURIComponent(row.message_id)}#message-${row.message_id}`
      : "";
    return `/channels/${encodeURIComponent(row.channel_slug)}${focus}`;
  }
  if (row.conversation_id) {
    const focus = row.message_id
      ? `?message=${encodeURIComponent(row.message_id)}#message-${row.message_id}`
      : "";
    return `/messages/${row.conversation_id}${focus}`;
  }
  if (row.kind === "call_missed") {
    return null;
  }
  if (row.kind === "friend_request_received") {
    return row.friend_request_id
      ? `/friends/requests/${row.friend_request_id}`
      : "/friends/requests";
  }
  if (row.kind === "friend_request_accepted") {
    return row.actor_id ? `/friends/${row.actor_id}` : "/friends";
  }
  return null;
}

type ItemRow = Awaited<
  ReturnType<AppSupabaseClient["rpc"]>
> extends never ? never : {
  id: string;
  kind: string;
  category: string;
  category_rank: number;
  actor_id: string;
  actor_display_name: string;
  actor_username: string;
  actor_count: number;
  event_count: number;
  conversation_id: string;
  channel_slug: string;
  channel_name: string;
  message_id: string;
  message_snippet: string;
  call_id: string;
  friend_request_id: string;
  moderation_action_id: string;
  title: string;
  body: string;
  action_href: string;
  seen_at: string;
  read_at: string;
  last_event_at: string;
  change_seq: number;
};

function toItem(row: ItemRow): NotificationItem | null {
  if (row.kind === "call_completed") return null;

  const kind = kindByDatabaseValue[row.kind];
  const category = categoryByDatabaseValue[row.category];
  if (!kind || !category) return null;

  return {
    id: row.id,
    kind,
    category,
    categoryRank: row.category_rank,
    actor: row.actor_id
      ? {
          id: row.actor_id,
          displayName: row.actor_display_name,
          username: row.actor_username,
          avatarUrl: null,
        }
      : null,
    actorCount: row.actor_count,
    eventCount: row.event_count,
    conversationId: row.conversation_id || null,
    channelSlug: row.channel_slug || null,
    channelName: row.channel_name || null,
    messageId: row.message_id || null,
    messageSnippet: row.message_snippet || null,
    callId: row.call_id || null,
    friendRequestId: row.friend_request_id || null,
    moderationActionId: row.moderation_action_id || null,
    title: row.title || null,
    body: row.body || null,
    actionHref: socialHref(row),
    seenAt: row.seen_at || null,
    readAt: row.read_at || null,
    lastEventAt: row.last_event_at,
    changeSeq: row.change_seq,
  };
}

export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async getSummary(): Promise<ServiceResult<NotificationSummary>> {
    return safely("notifications.getSummary", async () => {
      const { data, error } = await this.client.rpc("get_notification_summary");
      if (error) {
        return failWith(
          "notifications.getSummary",
          "Could not refresh notifications."
        )(error);
      }
      const row = data?.[0];
      return serviceSuccess({
        unreadCount: row?.unread_count ?? 0,
        unseenCount: row?.unseen_count ?? 0,
        latestChangeSeq: row?.latest_change_seq ?? 0,
      });
    });
  }

  async listPage(input: {
    filter: NotificationFilter;
    cursor?: NotificationPage["nextCursor"];
    limit?: number;
  }): Promise<ServiceResult<NotificationPage>> {
    return safely("notifications.listPage", async () => {
      const limit = Math.min(Math.max(input.limit ?? defaultPageSize, 1), 50);
      const { data, error } = await this.client.rpc("list_notification_items", {
        p_filter: input.filter,
        p_limit: limit,
        ...(input.cursor
          ? {
              p_cursor_category_rank: input.cursor.categoryRank,
              p_cursor_last_event_at: input.cursor.lastEventAt,
              p_cursor_id: input.cursor.id,
            }
          : {}),
      });
      if (error) {
        return failWith(
          "notifications.listPage",
          "Could not load notifications."
        )(error);
      }

      const mapped = (data ?? []).map(toItem).filter((item): item is NotificationItem => item !== null);
      const items = mapped.slice(0, limit);
      const last = mapped.length > limit ? items.at(-1) : null;
      return serviceSuccess({
        items,
        nextCursor: last
          ? {
              categoryRank: last.categoryRank,
              lastEventAt: last.lastEventAt,
              id: last.id,
            }
          : null,
      });
    });
  }

  async listChanges(afterChangeSeq: number): Promise<ServiceResult<NotificationChange[]>> {
    return safely("notifications.listChanges", async () => {
      const { data, error } = await this.client.rpc("list_notification_changes", {
        p_after_change_seq: Math.max(0, afterChangeSeq),
        p_limit: 500,
      });
      if (error) {
        return failWith(
          "notifications.listChanges",
          "Could not catch up notifications."
        )(error);
      }
      return serviceSuccess(
        (data ?? []).map((row) => ({
          id: row.id,
          changeSeq: row.change_seq,
          seenAt: row.seen_at || null,
          readAt: row.read_at || null,
          archivedAt: row.archived_at || null,
        }))
      );
    });
  }
}
