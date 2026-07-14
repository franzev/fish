import { describe, expect, it, vi } from "vitest";
import type { BookingCommandService, LessonSlot } from "@/lib/services";
import { createBookingActionHandlers } from "./action-handlers";

const slot: LessonSlot = {
  id: "11111111-1111-4111-8111-111111111111",
  coachId: "22222222-2222-4222-8222-222222222222",
  startsAt: "2026-07-21T10:30:00.000Z",
  endsAt: "2026-07-21T11:20:00.000Z",
  durationMinutes: 50,
  bookedByClientId: "33333333-3333-4333-8333-333333333333",
  bookedAt: "2026-07-14T10:00:00.000Z",
};

describe("booking action handlers", () => {
  it("rejects a missing or malformed slot before calling the command", async () => {
    const bookSlot = vi.fn();
    const result = await createBookingActionHandlers({ bookSlot }).book({ slotId: "nope" });
    expect(result).toEqual({ status: "notice", notice: "Choose an available lesson time." });
    expect(bookSlot).not.toHaveBeenCalled();
  });

  it("returns the booked lesson id", async () => {
    const bookSlot = vi.fn().mockResolvedValue({ ok: true, slot });
    const commands: BookingCommandService = { bookSlot };
    const result = await createBookingActionHandlers(commands).book({ slotId: slot.id });
    expect(result).toEqual({ status: "booked", lessonId: slot.id });
  });

  it("preserves calm conflict guidance from the command boundary", async () => {
    const commands: BookingCommandService = {
      bookSlot: vi.fn().mockResolvedValue({
        ok: false,
        code: "slot_unavailable",
        notice: "That time was just booked. Choose another available time.",
      }),
    };
    await expect(createBookingActionHandlers(commands).book({ slotId: slot.id })).resolves.toEqual({
      status: "notice",
      notice: "That time was just booked. Choose another available time.",
    });
  });
});
