import { describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "./types";
import { SupabaseLessonRepository } from "./booking-repository";

const row = {
  id: "slot-1",
  coach_id: "coach-1",
  starts_at: "2026-07-21T10:30:00.000Z",
  ends_at: "2026-07-21T11:20:00.000Z",
  duration_minutes: 50,
  booked_by_client_id: null,
  booked_at: null,
  created_at: "2026-07-14T00:00:00.000Z",
  updated_at: "2026-07-14T00:00:00.000Z",
};

function query(data: unknown) {
  const result = { data, error: null };
  const builder: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    maybeSingle: vi.fn(async () => ({
      data: Array.isArray(data) ? data[0] ?? null : data,
      error: null,
    })),
  };
  for (const method of ["select", "eq", "is", "gt", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}

describe("SupabaseLessonRepository", () => {
  it("lists and maps available slots", async () => {
    const lessonQuery = query([row]);
    const from = vi.fn(() => lessonQuery);
    const repository = new SupabaseLessonRepository({ from } as unknown as AppSupabaseClient);
    const result = await repository.listAvailable("coach-1", "2026-07-14T00:00:00.000Z");
    expect(result).toEqual({
      ok: true,
      data: [{
        id: "slot-1",
        coachId: "coach-1",
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        durationMinutes: 50,
        bookedByClientId: null,
        bookedAt: null,
      }],
    });
    expect(from).toHaveBeenCalledWith("lesson_slots");
    expect(lessonQuery.limit).toHaveBeenCalledWith(120);
  });

  it("returns the earliest active booking for the client", async () => {
    const booked = { ...row, booked_by_client_id: "client-1", booked_at: row.created_at };
    const repository = new SupabaseLessonRepository({
      from: vi.fn(() => query(booked)),
    } as unknown as AppSupabaseClient);
    const result = await repository.findUpcomingForClient("client-1", "2026-07-14T00:00:00.000Z");
    expect(result.ok && result.data?.bookedByClientId).toBe("client-1");
  });
});
