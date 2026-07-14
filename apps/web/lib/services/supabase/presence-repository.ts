import type {
  EffectivePresenceStatus,
  PresencePreference,
  PresenceRepository,
  PresenceSnapshot,
} from "../contracts";
import {
  mapSupabaseError,
  safely,
  type SupabaseResponse,
} from "./shared";
import type { AppSupabaseClient } from "./types";
import { serviceFailure, serviceSuccess } from "../errors";

type SnapshotRow = {
  user_id: string;
  status: EffectivePresenceStatus;
  last_heartbeat_at: string | null;
  last_seen_at: string | null;
  revision: number;
  updated_at: string;
};

function toSnapshot(row: SnapshotRow): PresenceSnapshot {
  return {
    userId: row.user_id,
    status: row.status,
    lastHeartbeatAt: row.last_heartbeat_at,
    lastSeenAt: row.last_seen_at,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

export class SupabasePresenceRepository implements PresenceRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  listVisible() {
    return safely("presence.listVisible", async () => {
      const { data, error } = await this.client.rpc("list_visible_presence");
      if (error) {
        return serviceFailure(mapSupabaseError(error, {
          code: "database",
          fallbackMessage: "Could not load presence.",
          operation: "presence.listVisible",
          recoverable: true,
        }));
      }
      return serviceSuccess(((data ?? []) as SnapshotRow[]).map(toSnapshot));
    });
  }

  getOwnPreference() {
    return safely("presence.getOwnPreference", async () => {
      const response = await this.client
        .from("presence_preferences")
        .select("mode")
        .maybeSingle() as SupabaseResponse<{ mode: PresencePreference }>;
      if (response.error) {
        return serviceFailure(mapSupabaseError(response.error, {
          code: "database",
          fallbackMessage: "Could not load your status.",
          operation: "presence.getOwnPreference",
          recoverable: true,
        }));
      }
      return serviceSuccess(response.data?.mode ?? "automatic");
    });
  }
}
