import type {
  NotificationChange,
  NotificationFilter,
  NotificationPage,
  NotificationSummary,
} from "@fish/core/notification-state";
import type { ServiceResult } from "../errors";
import type { CommandResult } from "./command-results";

export interface NotificationRepository {
  getSummary(): Promise<ServiceResult<NotificationSummary>>;
  listPage(input: {
    filter: NotificationFilter;
    cursor?: NotificationPage["nextCursor"];
    limit?: number;
  }): Promise<ServiceResult<NotificationPage>>;
  listChanges(afterChangeSeq: number): Promise<ServiceResult<NotificationChange[]>>;
}

export type NotificationCommand =
  | { action: "mark-seen" | "mark-read"; notificationIds: string[]; throughChangeSeq: number }
  | { action: "mark-all-read" | "archive-read"; throughChangeSeq: number }
  | { action: "restore"; archiveBatchId: string }
  | { action: "acknowledge-moderation"; moderationActionId: string };

export type NotificationCommandResult = CommandResult<{
  updated: number;
  archiveBatchId?: string;
}>;

export interface NotificationCommandService {
  execute(command: NotificationCommand): Promise<NotificationCommandResult>;
}

export interface NotificationRealtimeHint {
  itemId: string;
  changeSeq: number;
  reason: string;
  occurredAt: string;
}

export interface NotificationRealtimeService {
  subscribe(
    userId: string,
    onHint: (hint: NotificationRealtimeHint) => void,
    onRecovery?: () => void,
    onStatus?: (status: "connected" | "disconnected") => void
  ): () => void;
}

export interface NavigationAttention {
  surface: "channel" | "direct" | "friends";
  entityId: string | null;
  conversationId: string | null;
  unreadCount: number;
  mentionCount: number;
  newActivity: boolean;
}

export interface NavigationAttentionRepository {
  list(): Promise<ServiceResult<NavigationAttention[]>>;
}

export interface AttentionRealtimeService {
  subscribe(
    conversationIds: string[],
    onChange: (conversationId: string) => void,
    onRecovery?: () => void
  ): () => void;
}
