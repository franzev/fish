"use client";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/features/chat";
import { cn } from "@/lib/utils";
import { IconCheck, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type {
  BookLessonAction,
  BookingCoach,
  BookingClientContext,
} from "../../contracts";
import {
  formatLessonDate,
  formatLessonTime,
  formatTimeZoneLabel,
  lessonDateKey,
} from "../../format";
import type { LessonSlot } from "@/lib/services";

interface BookingScreenProps extends Omit<BookingClientContext, "clientId"> {
  coach: BookingCoach | null;
  slots: LessonSlot[];
  upcomingLesson: LessonSlot | null;
  bookAction: BookLessonAction;
}

export function BookingScreen({
  coach,
  slots,
  upcomingLesson,
  locale,
  timeZone,
  timeFormatPref,
  bookAction,
}: BookingScreenProps) {
  const [selectedId, setSelectedId] = useState("");
  const [state, formAction, pending] = useActionState(bookAction, { status: "idle" });
  const selected = slots.find((slot) => slot.id === selectedId) ?? null;
  const grouped = useMemo(() => {
    const groups = new Map<string, LessonSlot[]>();
    for (const slot of slots) {
      const key = lessonDateKey(slot.startsAt, timeZone);
      const group = groups.get(key) ?? [];
      group.push(slot);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [slots, timeZone]);

  return (
    <div className="flex min-h-full w-full flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-md border-b border-divider bg-surface px-page py-md">
        <h1 className="flex-1 text-heading-sm">Book your lesson</h1>
        <Link
          href="/home"
          aria-label="Close booking"
          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:text-foreground"
        >
          <IconX size={24} stroke={1.75} aria-hidden="true" />
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        {!coach || upcomingLesson || slots.length === 0 ? (
          <main className="mx-auto flex min-h-full w-full max-w-content flex-col justify-center px-page py-xl">
            {upcomingLesson && coach ? (
              <Card>
                <div className="flex items-start gap-sm">
                  <IconCheck className="mt-3xs shrink-0 text-success" size={24} aria-hidden="true" />
                  <div>
                    <h2 className="text-heading-sm">Your lesson is already booked</h2>
                    <p className="mt-xs text-body">
                      {formatLessonDate(upcomingLesson.startsAt, { locale, timeZone })} at{" "}
                      {formatLessonTime(upcomingLesson.startsAt, timeFormatPref, { locale, timeZone })}
                      {" "}with {coach.displayName}.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/book/confirmed/${upcomingLesson.id}`}
                  className={cn(buttonVariants({ fullWidth: true }), "mt-lg")}
                >
                  View your lesson
                </Link>
              </Card>
            ) : (
              <Card>
                <h2 className="text-heading-sm">
                  {coach ? "No lesson times are available yet" : "Booking is not ready yet"}
                </h2>
                <p className="mt-xs text-body">
                  {coach
                    ? `${coach.displayName} will add more times soon.`
                    : "Your coach connection is still being prepared."}
                </p>
                <Link href="/home" className={cn(buttonVariants({ fullWidth: true }), "mt-lg")}>
                  Back to home
                </Link>
              </Card>
            )}
          </main>
        ) : (
          <main className="mx-auto flex w-full max-w-marketing flex-col gap-xl px-page py-xl lg:flex-row lg:items-start lg:gap-2xl">
            <section className="w-full flex-1" aria-labelledby="available-times-heading">
              <div className="mb-lg">
                <h2 id="available-times-heading" className="text-display">
                  Choose a time
                </h2>
                <p className="mt-xs text-body">Available times with {coach.displayName}</p>
              </div>

              <div className="flex flex-col gap-xl">
                {grouped.map((group) => {
                  const first = group[0];
                  if (!first) return null;
                  const dateLabel = formatLessonDate(first.startsAt, { locale, timeZone });
                  return (
                    <section key={lessonDateKey(first.startsAt, timeZone)} aria-label={dateLabel}>
                      <h3 className="mb-sm text-ui font-semibold text-foreground">{dateLabel}</h3>
                      <div className="flex flex-wrap gap-xs">
                        {group.map((slot) => {
                          const active = slot.id === selectedId;
                          return (
                            <Button
                              key={slot.id}
                              type="button"
                              variant="secondary"
                              aria-pressed={active}
                              className={cn(active && "bg-surface-3 font-semibold")}
                              onClick={() => setSelectedId(slot.id)}
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

              <p className="mt-xl text-ui-sm text-muted">
                Times shown in {formatTimeZoneLabel(timeZone, slots[0]?.startsAt ?? new Date())}.
              </p>
            </section>

            <aside className="w-full lg:sticky lg:top-xl lg:w-notifications" aria-label="Lesson summary">
              <Card>
                <div className="flex items-center gap-sm">
                  <Avatar
                    profileId={coach.id}
                    src={coach.avatarUrl ?? undefined}
                    name={coach.displayName}
                    size="lg"
                    alt=""
                  />
                  <div>
                    <h2 className="font-semibold text-foreground">English with {coach.displayName}</h2>
                    <p className="mt-3xs text-ui-sm text-muted">50-minute lesson</p>
                  </div>
                </div>

                <div className="my-lg border-t border-divider" />

                <div aria-live="polite" className="min-h-control">
                  {selected ? (
                    <>
                      <p className="font-semibold text-foreground">
                        {formatLessonDate(selected.startsAt, { locale, timeZone })}
                      </p>
                      <p className="mt-3xs text-body">
                        {formatLessonTime(selected.startsAt, timeFormatPref, { locale, timeZone })}
                      </p>
                    </>
                  ) : (
                    <p className="text-body">Choose an available time.</p>
                  )}
                </div>

                {state.status === "notice" && (
                  <Alert tone="notice" className="mt-md">
                    {state.notice}
                  </Alert>
                )}

                <form action={formAction} className="mt-lg">
                  <input type="hidden" name="slotId" value={selectedId} />
                  <Button type="submit" fullWidth loading={pending}>
                    Book lesson
                  </Button>
                </form>
              </Card>
            </aside>
          </main>
        )}
      </div>
    </div>
  );
}
