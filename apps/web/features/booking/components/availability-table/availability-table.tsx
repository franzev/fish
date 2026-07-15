"use client";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import type { LessonSlot } from "@/lib/services";
import { cn } from "@/lib/utils";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { formatLessonTime, lessonDateKey } from "../../format";

interface AvailabilityTableProps {
  slots: LessonSlot[];
  selectedId: string;
  locale: string;
  timeZone: string;
  timeFormatPref: TimeFormatPref;
  onSelect: (slotId: string) => void;
}

interface CalendarDay {
  key: string;
  weekday: string;
  date: string;
  fullLabel: string;
}

interface ScheduleRow {
  key: string;
  slotsByDay: Map<string, LessonSlot>;
}

interface ScheduleWeek {
  key: string;
  label: string;
  days: CalendarDay[];
  rows: ScheduleRow[];
}

function calendarDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

function calendarDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addCalendarDays(dateKey: string, days: number): string {
  const date = calendarDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return calendarDateKey(date);
}

function weekStartKey(dateKey: string): string {
  const date = calendarDate(dateKey);
  return addCalendarDays(dateKey, -date.getUTCDay());
}

function localTimeKey(value: string, timeZone: string): string {
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

function buildScheduleWeeks(
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

      const rows = [...rowSlots.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, slotsByDay]) => ({ key, slotsByDay }));

      return {
        key: weekKey,
        label: new Intl.DateTimeFormat(locale, {
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }).format(calendarDate(weekKey)),
        days,
        rows,
      };
    });
}

export function AvailabilityTable({
  slots,
  selectedId,
  locale,
  timeZone,
  timeFormatPref,
  onSelect,
}: AvailabilityTableProps) {
  const weeks = useMemo(
    () => buildScheduleWeeks(slots, locale, timeZone),
    [locale, slots, timeZone]
  );
  const [weekIndex, setWeekIndex] = useState(0);
  const activeWeekIndex = Math.min(weekIndex, Math.max(weeks.length - 1, 0));
  const week = weeks[activeWeekIndex];

  if (!week) return null;

  return (
    <section aria-labelledby={`week-${week.key}`}>
      <div className="mb-sm flex items-center gap-sm">
        <IconButton
          type="button"
          appearance="ghost"
          label="Previous week"
          disabled={activeWeekIndex === 0}
          onClick={() => setWeekIndex(Math.max(activeWeekIndex - 1, 0))}
          icon={<IconChevronLeft size={20} stroke={1.75} aria-hidden="true" />}
        />
        <h3
          id={`week-${week.key}`}
          className="flex-1 text-center text-ui font-semibold text-foreground"
          aria-live="polite"
        >
          Week of {week.label}
        </h3>
        <IconButton
          type="button"
          appearance="ghost"
          label="Next week"
          disabled={activeWeekIndex === weeks.length - 1}
          onClick={() => setWeekIndex(
            Math.min(activeWeekIndex + 1, weeks.length - 1)
          )}
          icon={<IconChevronRight size={20} stroke={1.75} aria-hidden="true" />}
        />
      </div>

      <div className="hidden lg:block">
        <table
          className="w-full table-fixed border-separate border-spacing-xs"
          aria-label={`Available times for week of ${week.label}`}
        >
          <thead>
            <tr>
              {week.days.map((day) => (
                <th
                  key={day.key}
                  scope="col"
                  aria-label={`${day.weekday} ${day.date}`}
                  className="pb-xs text-center align-bottom"
                >
                  <span className="block text-ui-sm font-semibold text-foreground">
                    {day.weekday}
                  </span>
                  <span className="mt-3xs block text-ui-xs text-muted">
                    {day.date}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.rows.map((row) => (
              <tr key={row.key}>
                {week.days.map((day) => {
                  const slot = row.slotsByDay.get(day.key);
                  if (!slot) {
                    return (
                      <td key={day.key} className="text-center align-middle">
                        <span
                          className="inline-flex min-h-control w-full items-center justify-center text-muted"
                          aria-label="Not available"
                        >
                          −
                        </span>
                      </td>
                    );
                  }

                  const active = slot.id === selectedId;
                  return (
                    <td key={day.key} className="align-middle">
                      <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        aria-pressed={active}
                        className={cn(
                          "whitespace-nowrap px-xs text-ui-sm tabular-nums",
                          active && "border-border bg-surface-3"
                        )}
                        onClick={() => onSelect(slot.id)}
                      >
                        {formatLessonTime(slot.startsAt, timeFormatPref, {
                          locale,
                          timeZone,
                        })}
                      </Button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-lg lg:hidden">
        {week.days.map((day) => {
          const daySlots = week.rows.flatMap((row) => {
            const slot = row.slotsByDay.get(day.key);
            return slot ? [slot] : [];
          });
          if (daySlots.length === 0) return null;

          return (
            <section key={day.key} aria-label={day.fullLabel}>
              <h4 className="mb-sm text-ui font-semibold text-foreground">{day.fullLabel}</h4>
              <div className="flex flex-wrap gap-xs">
                {daySlots.map((slot) => {
                  const active = slot.id === selectedId;
                  return (
                    <Button
                      key={slot.id}
                      type="button"
                      variant="secondary"
                      aria-pressed={active}
                      className={cn(
                        "whitespace-nowrap px-sm tabular-nums",
                        active && "border-border bg-surface-3"
                      )}
                      onClick={() => onSelect(slot.id)}
                    >
                      {formatLessonTime(slot.startsAt, timeFormatPref, { locale, timeZone })}
                    </Button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
