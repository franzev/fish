import { describe, expect, it } from "vitest";
import type { LessonSlot } from "@/lib/services";
import { addCalendarDays, buildScheduleWeeks, weekStartKey } from "./schedule-weeks";

function slot(id: string, startsAt: string): LessonSlot {
  return {
    id,
    coachId: "coach-1",
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 50 * 60 * 1000).toISOString(),
    durationMinutes: 50,
    bookedByClientId: null,
    bookedAt: null,
  };
}

describe("schedule week builder", () => {
  it("builds Sunday weeks across month boundaries", () => {
    expect(weekStartKey("2026-08-01")).toBe("2026-07-26");
    expect(addCalendarDays("2026-07-26", 6)).toBe("2026-08-01");
  });

  it("groups sparse slots by local day and local time", () => {
    const weeks = buildScheduleWeeks(
      [
        slot("one", "2026-07-19T00:00:00.000Z"),
        slot("two", "2026-07-22T06:30:00.000Z"),
      ],
      "en-US",
      "Asia/Manila"
    );
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.days).toHaveLength(7);
    expect(weeks[0]?.rows.map((row) => row.key)).toEqual(["08:00", "14:30"]);
    expect(weeks[0]?.rows[0]?.slotsByDay.get("2026-07-19")?.id).toBe("one");
  });
});
