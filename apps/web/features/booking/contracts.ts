import type { LessonSlot } from "@/lib/services";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import type { UserRole } from "@fish/core/roles";

export interface BookingCoach {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface BookingClientContext {
  clientId: string;
  locale: string;
  timeZone: string;
  timeFormatPref: TimeFormatPref;
}

export type BookingPageData =
  | { role: Exclude<UserRole, "client"> }
  | ({
      role: "client";
      coach: BookingCoach | null;
      slots: LessonSlot[];
      upcomingLesson: LessonSlot | null;
    } & BookingClientContext);

export type BookingConfirmationData =
  | { role: Exclude<UserRole, "client"> }
  | ({
      role: "client";
      coach: BookingCoach | null;
      lesson: LessonSlot | null;
    } & BookingClientContext);

export interface UpcomingLessonData {
  coach: BookingCoach;
  lesson: LessonSlot;
  locale: string;
  timeZone: string;
  timeFormatPref: TimeFormatPref;
}

export type BookLessonActionState =
  | { status: "idle"; notice?: undefined }
  | { status: "notice"; notice: string };

export type BookLessonResult =
  | { status: "booked"; lessonId: string }
  | { status: "notice"; notice: string };

export type BookLessonAction = (
  previousState: BookLessonActionState,
  formData: FormData
) => Promise<BookLessonActionState>;
