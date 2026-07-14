import type { BookingCommandService } from "@/lib/services";
import { z } from "zod";
import type { BookLessonResult } from "../contracts";

const bookingSchema = z.object({ slotId: z.uuid() });

export function createBookingActionHandlers(commands: BookingCommandService) {
  return {
    async book(input: unknown): Promise<BookLessonResult> {
      const parsed = bookingSchema.safeParse(input);
      if (!parsed.success) {
        return { status: "notice", notice: "Choose an available lesson time." };
      }

      const result = await commands.bookSlot(parsed.data.slotId);
      return result.ok
        ? { status: "booked", lessonId: result.slot.id }
        : { status: "notice", notice: result.notice };
    },
  };
}
