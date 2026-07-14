import type {
  BookingCommandResult,
  BookingCommandService,
  LessonSlot,
} from "../contracts";
import type { AppSupabaseClient } from "./types";

type CommandResponse = {
  slot?: LessonSlot;
  code?: string;
  error?: string;
};

export class SupabaseBookingCommandService implements BookingCommandService {
  constructor(private readonly client: AppSupabaseClient) {}

  async bookSlot(slotId: string): Promise<BookingCommandResult> {
    const result = await this.client.functions.invoke<CommandResponse>(
      "booking-command",
      { body: { action: "book", slotId }, timeout: 15_000 }
    );
    if (!result.error && result.data?.slot) {
      return { ok: true, slot: result.data.slot };
    }

    let payload = result.data;
    const context = result.error && "context" in result.error
      ? result.error.context
      : null;
    if (context instanceof Response) {
      payload = await context.json().catch(() => null) as CommandResponse | null;
    }

    return {
      ok: false,
      code: payload?.code ?? "booking_unavailable",
      notice:
        payload?.error ??
        "Booking is taking a break. Your lesson was not booked yet.",
    };
  }
}
