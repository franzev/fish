import { formatTimeOfDay, type TimeFormatPref } from "@/lib/prefs/time-format";
import type { LessonSlot } from "@/lib/services";

interface LessonFormatOptions {
  locale: string;
  timeZone: string;
}

function validDate(value: Date | string): Date | null {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLessonDate(
  value: Date | string,
  options: LessonFormatOptions
): string {
  const date = validDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(options.locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: options.timeZone,
  }).format(date);
}

export function formatLessonTime(
  value: Date | string,
  pref: TimeFormatPref,
  options: LessonFormatOptions
): string {
  return formatTimeOfDay(value, pref, options);
}

export function lessonDateKey(
  value: Date | string,
  timeZone: string
): string {
  const date = validDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatTimeZoneLabel(
  timeZone: string,
  at: Date | string = new Date()
): string {
  try {
    const date = validDate(at) ?? new Date();
    const offset = new Intl.DateTimeFormat("en", {
      timeZone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;
    const normalized = offset?.replace("GMT", "UTC") ?? "UTC";
    return normalized === "UTC" ? `${timeZone} (UTC)` : `${timeZone} (${normalized})`;
  } catch {
    return "UTC";
  }
}

export function isLessonJoinable(
  lesson: Pick<LessonSlot, "startsAt" | "endsAt">,
  joinWindowMinutes: number,
  now = new Date()
): boolean {
  const startsAt = new Date(lesson.startsAt).getTime();
  const endsAt = new Date(lesson.endsAt).getTime();
  const current = now.getTime();
  if ([startsAt, endsAt, current].some(Number.isNaN)) return false;
  if (!Number.isSafeInteger(joinWindowMinutes) || joinWindowMinutes < 0) {
    return false;
  }
  return current >= startsAt - joinWindowMinutes * 60 * 1000 && current < endsAt;
}
