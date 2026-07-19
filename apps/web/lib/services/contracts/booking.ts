import type { ServiceResult } from "../errors";
import type { CommandResult } from "./command-results";

export interface LessonSlot {
  id: string;
  coachId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  bookedByClientId: string | null;
  bookedAt: string | null;
}

export interface LessonRepository {
  listAvailable(coachId: string, afterIso?: string): Promise<ServiceResult<LessonSlot[]>>;
  findUpcomingForClient(clientId: string, afterIso?: string): Promise<ServiceResult<LessonSlot | null>>;
  findBookedByIdForClient(slotId: string, clientId: string): Promise<ServiceResult<LessonSlot | null>>;
}

export type BookingCommandResult = CommandResult<{ slot: LessonSlot }>;

export interface BookingCommandService {
  bookSlot(slotId: string): Promise<BookingCommandResult>;
}
