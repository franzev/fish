"use client";

import { Popover } from "@base-ui/react/popover";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

interface DatePickerPopoverProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

const weekdays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIso(value: string): Date {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function monthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function DatePickerPopover({ value, onChange, label }: DatePickerPopoverProps) {
  const selected = fromIso(value);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1)
  );
  const popupRef = useRef<HTMLDivElement | null>(null);
  const days = useMemo(() => monthDays(visibleMonth), [visibleMonth]);
  const formatted = selected.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const moveMonth = (amount: number) => {
    setVisibleMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + amount, 1)
    );
  };

  const focusDate = (date: Date) => {
    const iso = toIso(date);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    requestAnimationFrame(() => {
      popupRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)
        ?.focus();
    });
  };

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const next = new Date(date);
    if (event.key === "ArrowLeft") next.setDate(next.getDate() - 1);
    else if (event.key === "ArrowRight") next.setDate(next.getDate() + 1);
    else if (event.key === "ArrowUp") next.setDate(next.getDate() - 7);
    else if (event.key === "ArrowDown") next.setDate(next.getDate() + 7);
    else if (event.key === "PageUp") next.setMonth(next.getMonth() - 1);
    else if (event.key === "PageDown") next.setMonth(next.getMonth() + 1);
    else return;
    event.preventDefault();
    focusDate(next);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={label}
        className="flex min-h-control min-w-0 flex-1 items-center justify-between rounded-control bg-surface-2 px-sm text-left text-ui text-foreground hover:bg-surface-3"
      >
        <span>{formatted}</span>
        <IconCalendar size={20} stroke={1.75} aria-hidden="true" className="text-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
          <Popover.Popup
            ref={popupRef}
            aria-label="Choose a date"
            className="w-search-pop-mobile rounded-card bg-surface p-sm sm:w-calendar sm:p-lg"
          >
            <div className="flex items-center justify-between border-b border-divider pb-md">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
                className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2"
              >
                <IconChevronLeft size={20} stroke={1.75} aria-hidden="true" />
              </button>
              <p className="text-ui font-medium text-foreground">
                {visibleMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => moveMonth(1)}
                className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:bg-surface-2"
              >
                <IconChevronRight size={20} stroke={1.75} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-sm grid grid-cols-7" role="row">
              {weekdays.map((weekday) => (
                <span
                  key={weekday}
                  role="columnheader"
                  className="flex min-h-control items-center justify-center text-ui-sm font-medium text-muted"
                >
                  {weekday}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 overflow-hidden rounded-control" role="grid">
              {days.map((date) => {
                const iso = toIso(date);
                const inMonth = date.getMonth() === visibleMonth.getMonth();
                const isSelected = iso === value;
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    data-date={iso}
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onKeyDown={(event) => handleDayKeyDown(event, date)}
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={`relative min-h-control rounded-control text-ui ${
                      isSelected
                        ? "bg-surface-3 font-semibold text-foreground after:absolute after:inset-x-xs after:bottom-0 after:h-3xs after:bg-primary"
                        : inMonth
                          ? "text-foreground hover:bg-surface-2"
                          : "text-muted hover:bg-surface-2"
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
