"use client";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/features/chat";
import { cn } from "@/lib/utils";
import { IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import type {
  BookLessonAction,
  BookingCoach,
  BookingClientContext,
} from "../../contracts";
import {
  formatLessonDate,
  formatLessonTime,
  formatTimeZoneLabel,
} from "../../format";
import type { LessonSlot } from "@/lib/services";
import { AvailabilityTable } from "../availability-table";

interface BookingScreenProps extends Omit<BookingClientContext, "clientId"> {
  coach: BookingCoach | null;
  slots: LessonSlot[];
  bookAction: BookLessonAction;
}

export function BookingScreen({
  coach,
  slots,
  locale,
  timeZone,
  timeFormatPref,
  bookAction,
}: BookingScreenProps) {
  const [selectedId, setSelectedId] = useState("");
  const [state, formAction, pending] = useActionState(bookAction, { status: "idle" });
  const selected = slots.find((slot) => slot.id === selectedId) ?? null;

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
        {!coach || slots.length === 0 ? (
          <main className="mx-auto flex min-h-full w-full max-w-content flex-col justify-center px-page py-xl">
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

              <AvailabilityTable
                slots={slots}
                selectedId={selectedId}
                locale={locale}
                timeZone={timeZone}
                timeFormatPref={timeFormatPref}
                onSelect={setSelectedId}
              />

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
