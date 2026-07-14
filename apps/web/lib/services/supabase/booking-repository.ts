import {
  serviceFailure,
  serviceSuccess,
  type ServiceResult,
} from "@/lib/services/errors";
import type { LessonSlotRow } from "@fish/supabase";
import type { LessonRepository, LessonSlot } from "../contracts";
import type { AppSupabaseClient } from "./types";
import { mapSupabaseError, safely, type SupabaseResponse } from "./shared";

export function toLessonSlot(row: LessonSlotRow): LessonSlot {
  return {
    id: row.id,
    coachId: row.coach_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    durationMinutes: row.duration_minutes,
    bookedByClientId: row.booked_by_client_id,
    bookedAt: row.booked_at,
  };
}

function readFailure(operation: string, message: string, error: SupabaseResponse<unknown>["error"]) {
  return serviceFailure(
    mapSupabaseError(error, {
      code: "database",
      fallbackMessage: message,
      operation,
      recoverable: true,
    })
  );
}

export class SupabaseLessonRepository implements LessonRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async listAvailable(
    coachId: string,
    afterIso = new Date().toISOString()
  ): Promise<ServiceResult<LessonSlot[]>> {
    return safely("lessons.listAvailable", async () => {
      const { data, error } = (await this.client
        .from("lesson_slots")
        .select("*")
        .eq("coach_id", coachId)
        .is("booked_by_client_id", null)
        .gt("starts_at", afterIso)
        .order("starts_at", { ascending: true })
        .limit(120)) as SupabaseResponse<LessonSlotRow[]>;

      if (error) {
        return readFailure(
          "lessons.listAvailable",
          "Could not load available lesson times.",
          error
        );
      }
      return serviceSuccess((data ?? []).map(toLessonSlot));
    });
  }

  async findUpcomingForClient(
    clientId: string,
    afterIso = new Date().toISOString()
  ): Promise<ServiceResult<LessonSlot | null>> {
    return safely("lessons.findUpcomingForClient", async () => {
      const { data, error } = (await this.client
        .from("lesson_slots")
        .select("*")
        .eq("booked_by_client_id", clientId)
        .gt("ends_at", afterIso)
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle()) as SupabaseResponse<LessonSlotRow>;

      if (error) {
        return readFailure(
          "lessons.findUpcomingForClient",
          "Could not load the upcoming lesson.",
          error
        );
      }
      return serviceSuccess(data ? toLessonSlot(data) : null);
    });
  }

  async findBookedByIdForClient(
    slotId: string,
    clientId: string
  ): Promise<ServiceResult<LessonSlot | null>> {
    return safely("lessons.findBookedByIdForClient", async () => {
      const { data, error } = (await this.client
        .from("lesson_slots")
        .select("*")
        .eq("id", slotId)
        .eq("booked_by_client_id", clientId)
        .maybeSingle()) as SupabaseResponse<LessonSlotRow>;

      if (error) {
        return readFailure(
          "lessons.findBookedByIdForClient",
          "Could not load that lesson.",
          error
        );
      }
      return serviceSuccess(data ? toLessonSlot(data) : null);
    });
  }
}
