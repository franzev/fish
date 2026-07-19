"use client";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import type { LessonSlot } from "@/lib/services";
import { cn } from "@/lib/utils";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { formatLessonTime } from "../../format";
import { buildScheduleWeeks } from "./schedule-weeks";

interface AvailabilityTableProps {
  slots: LessonSlot[];
  selectedId: string;
  locale: string;
  timeZone: string;
  timeFormatPref: TimeFormatPref;
  onSelect: (slotId: string) => void;
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
