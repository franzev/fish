import { describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "./types";
import { SupabaseBookingCommandService } from "./booking-command-service";

describe("SupabaseBookingCommandService", () => {
  it("maps a successful booking response", async () => {
    const slot = { id: "slot-1", coachId: "coach-1" };
    const invoke = vi.fn().mockResolvedValue({ data: { slot }, error: null });
    const service = new SupabaseBookingCommandService({ functions: { invoke } } as unknown as AppSupabaseClient);
    await expect(service.bookSlot("slot-1")).resolves.toEqual({ ok: true, slot });
    expect(invoke).toHaveBeenCalledWith("booking-command", {
      body: { action: "book", slotId: "slot-1" },
      timeout: 15_000,
    });
  });

  it("reads the calm error body from a failed function response", async () => {
    const context = new Response(JSON.stringify({
      code: "slot_unavailable",
      error: "That time was just booked. Choose another available time.",
    }));
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: { context },
    });
    const service = new SupabaseBookingCommandService({ functions: { invoke } } as unknown as AppSupabaseClient);
    await expect(service.bookSlot("slot-1")).resolves.toEqual({
      ok: false,
      code: "slot_unavailable",
      notice: "That time was just booked. Choose another available time.",
    });
  });
});
