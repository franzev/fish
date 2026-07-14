import type { ClientCall } from "../contracts";
import type { CallRow } from "@fish/supabase";

export function toClientCall(row: CallRow): ClientCall {
  return {
    id: row.id,
    lessonSlotId: row.lesson_slot_id,
    coachId: row.coach_id,
    clientId: row.client_id,
    initiatedBy: row.initiated_by,
    kind: row.kind,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    connectedAt: row.connected_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
