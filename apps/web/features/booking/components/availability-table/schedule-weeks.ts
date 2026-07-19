import type { LessonSlot } from "@/lib/services";
import { lessonDateKey } from "../../format";

export interface CalendarDay {
  key: string;
  weekday: string;
  date: string;
  fullLabel: string;
}

export interface ScheduleRow {
  key: string;
  slotsByDay: Map<string, LessonSlot>;
}

export interface ScheduleWeek {
  key: string;
  label: string;
  days: CalendarDay[];
  rows: ScheduleRow[];
}

export function calendarDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

function calendarDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addCalendarDays(dateKey: string, days: number): string {
  const date = calendarDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return calendarDateKey(date);
}

export function weekStartKey(dateKey: string): string {
  const date = calendarDate(dateKey);
  return addCalendarDays(dateKey, -date.getUTCDay());
}

export function localTimeKey(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
}

export function buildScheduleWeeks(
  slots: LessonSlot[],
  locale: string,
  timeZone: string
): ScheduleWeek[] {
  const slotsByWeek = new Map<string, LessonSlot[]>();

  for (const slot of slots) {
    const dateKey = lessonDateKey(slot.startsAt, timeZone);
    const weekKey = weekStartKey(dateKey);
    const weekSlots = slotsByWeek.get(weekKey) ?? [];
    weekSlots.push(slot);
    slotsByWeek.set(weekKey, weekSlots);
  }

  return [...slotsByWeek.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekKey, weekSlots]) => {
      const days = Array.from({ length: 7 }, (_, index) => {
        const key = addCalendarDays(weekKey, index);
        const date = calendarDate(key);
        return {
          key,
          weekday: new Intl.DateTimeFormat(locale, {
            weekday: "short",
            timeZone: "UTC",
          }).format(date),
          date: new Intl.DateTimeFormat(locale, {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(date),
          fullLabel: new Intl.DateTimeFormat(locale, {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          }).format(date),
        };
      });

      const rowSlots = new Map<string, Map<string, LessonSlot>>();
      for (const slot of weekSlots) {
        const timeKey = localTimeKey(slot.startsAt, timeZone);
        const slotsByDay = rowSlots.get(timeKey) ?? new Map<string, LessonSlot>();
        slotsByDay.set(lessonDateKey(slot.startsAt, timeZone), slot);
        rowSlots.set(timeKey, slotsByDay);
      }

      return {
        key: weekKey,
        label: new Intl.DateTimeFormat(locale, {
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }).format(calendarDate(weekKey)),
        days,
        rows: [...rowSlots.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, slotsByDay]) => ({ key, slotsByDay })),
      };
    });
}
