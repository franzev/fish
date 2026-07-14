import {
  serviceFailure,
  serviceSuccess,
  type ServiceResult,
} from "@/lib/services/errors";
import type {
  NavigationAttention,
  NavigationAttentionRepository,
} from "../contracts";
import { mapSupabaseError, safely } from "./shared";
import type { AppSupabaseClient } from "./types";

export class SupabaseNavigationAttentionRepository
  implements NavigationAttentionRepository
{
  constructor(private readonly client: AppSupabaseClient) {}

  async list(): Promise<ServiceResult<NavigationAttention[]>> {
    return safely("attention.list", async () => {
      const { data, error } = await this.client.rpc("list_navigation_attention");
      if (error) {
        return serviceFailure(mapSupabaseError(error, {
          code: "database",
          fallbackMessage: "Could not refresh activity badges.",
          operation: "attention.list",
          recoverable: true,
        }));
      }
      const items: NavigationAttention[] = [];
      for (const row of data ?? []) {
        if (row.surface !== "channel" && row.surface !== "direct" && row.surface !== "friends") {
          continue;
        }
        items.push({
          surface: row.surface,
          entityId: row.entity_id || null,
          conversationId: row.conversation_id || null,
          unreadCount: row.unread_count,
          mentionCount: row.mention_count,
          newActivity: row.new_activity,
        });
      }
      return serviceSuccess(items);
    });
  }
}
