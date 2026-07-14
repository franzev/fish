import "server-only";

import { getCurrentProfile } from "@/features/auth/server";
import { toTimeFormatPref } from "@/features/auth/contracts";
import {
  resolveAvatarUrlsSafely,
  type AppServices,
  type LessonSlot,
} from "@/lib/services";
import { getServerServices } from "@/lib/services/runtime/server";
import type {
  BookingClientContext,
  BookingCoach,
  BookingConfirmationData,
  BookingPageData,
  UpcomingLessonData,
} from "../contracts";
import { getLessonJoinWindowMinutes } from "./join-window";

function validTimeZone(value: string | null): string {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

async function clientContext(
  services: AppServices,
  clientId: string
): Promise<BookingClientContext> {
  const result = await services.database.clientProfiles.findById(clientId);
  if (!result.ok) throw result.error;
  return {
    clientId,
    locale: result.data?.locale || "en-US",
    timeZone: validTimeZone(result.data?.timezone ?? null),
    timeFormatPref: toTimeFormatPref(result.data?.timeFormatPref ?? null),
  };
}

async function coachById(
  services: AppServices,
  coachId: string
): Promise<BookingCoach | null> {
  const profile = await services.database.profiles.findDisplayNameById(
    coachId
  );
  if (!profile.ok) throw profile.error;
  if (!profile.data) return null;
  const avatar = (
    await resolveAvatarUrlsSafely(services.avatars, [coachId], "thumbnail")
  )[0]?.url ?? null;
  return {
    id: coachId,
    displayName: profile.data.displayName,
    avatarUrl: avatar,
  };
}

async function coachForClient(
  services: AppServices,
  clientId: string
): Promise<BookingCoach | null> {
  const assignment = await services.database.coachClients.findAssignmentForClient(clientId);
  if (!assignment.ok) throw assignment.error;
  return assignment.data ? coachById(services, assignment.data.coachId) : null;
}

async function currentClient(services: AppServices) {
  return getCurrentProfile({ auth: services.auth, profiles: services.database.profiles });
}

async function loadUpcoming(
  services: AppServices,
  clientId: string
): Promise<LessonSlot | null> {
  const result = await services.database.lessons.findUpcomingForClient(clientId);
  if (!result.ok) throw result.error;
  return result.data;
}

export async function getBookingPageData(
  injected?: AppServices
): Promise<BookingPageData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await currentClient(services);
  if (!profile) return null;
  if (profile.role !== "client") return { role: profile.role };

  const context = await clientContext(services, profile.userId);
  const coach = await coachForClient(services, profile.userId);
  if (!coach) {
    return { role: "client", coach: null, slots: [], ...context };
  }
  const slots = await services.database.lessons.listAvailable(coach.id);
  if (!slots.ok) throw slots.error;
  return { role: "client", coach, slots: slots.data, ...context };
}

export async function getBookingConfirmationData(
  lessonId: string,
  injected?: AppServices
): Promise<BookingConfirmationData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await currentClient(services);
  if (!profile) return null;
  if (profile.role !== "client") return { role: profile.role };

  const context = await clientContext(services, profile.userId);
  const lesson = await services.database.lessons.findBookedByIdForClient(
    lessonId,
    profile.userId
  );
  if (!lesson.ok) throw lesson.error;
  const coach = lesson.data ? await coachById(services, lesson.data.coachId) : null;
  return {
    role: "client",
    coach,
    lesson: lesson.data,
    joinWindowMinutes: getLessonJoinWindowMinutes(),
    ...context,
  };
}

export async function getUpcomingLessonData(
  injected?: AppServices
): Promise<UpcomingLessonData | null> {
  const services = injected ?? (await getServerServices());
  const profile = await currentClient(services);
  if (!profile || profile.role !== "client") return null;

  const lesson = await loadUpcoming(services, profile.userId);
  if (!lesson) return null;
  const [context, coach] = await Promise.all([
    clientContext(services, profile.userId),
    coachById(services, lesson.coachId),
  ]);
  return coach
    ? {
        coach,
        lesson,
        joinWindowMinutes: getLessonJoinWindowMinutes(),
        ...context,
      }
    : null;
}
