"use server";

import { getServerServices } from "@/lib/services/runtime/server";
import { redirect } from "next/navigation";
import type { BookLessonActionState } from "../contracts";
import { createBookingActionHandlers } from "./action-handlers";

export async function bookLessonAction(
  _previousState: BookLessonActionState,
  formData: FormData
): Promise<BookLessonActionState> {
  const { bookingCommands } = await getServerServices();
  const result = await createBookingActionHandlers(bookingCommands).book({
    slotId: formData.get("slotId"),
  });
  if (result.status === "booked") {
    redirect(`/book/confirmed/${result.lessonId}`);
  }
  return result;
}
