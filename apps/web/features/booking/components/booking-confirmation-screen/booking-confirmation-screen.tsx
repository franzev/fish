import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/features/chat";
import { cn } from "@/lib/utils";
import { IconCircleCheck, IconX } from "@tabler/icons-react";
import Link from "next/link";
import type { BookingCoach } from "../../contracts";
import { formatLessonDate, formatLessonTime, formatTimeZoneLabel } from "../../format";
import type { LessonSlot } from "@/lib/services";
import type { TimeFormatPref } from "@/lib/prefs/time-format";

interface BookingConfirmationScreenProps {
  coach: BookingCoach | null;
  lesson: LessonSlot | null;
  locale: string;
  timeZone: string;
  timeFormatPref: TimeFormatPref;
}

export function BookingConfirmationScreen({
  coach,
  lesson,
  locale,
  timeZone,
  timeFormatPref,
}: BookingConfirmationScreenProps) {
  const available = Boolean(coach && lesson);
  return (
    <div className="flex min-h-full w-full flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-md border-b border-divider bg-surface px-page py-md">
        <h1 className="flex-1 text-heading-sm">Lesson booking</h1>
        <Link
          href="/home"
          aria-label="Close confirmation"
          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:text-foreground"
        >
          <IconX size={24} stroke={1.75} aria-hidden="true" />
        </Link>
      </header>

      <main className="mx-auto flex min-h-full w-full max-w-content flex-1 flex-col justify-center px-page py-xl">
        <Card>
          <IconCircleCheck
            size={40}
            stroke={1.75}
            aria-hidden="true"
            className={available ? "text-success" : "text-muted"}
          />
          <h2 className="mt-md text-display">
            {available ? "Your lesson is booked" : "That lesson is not available"}
          </h2>
          {coach && lesson ? (
            <>
              <div className="mt-lg flex items-center gap-sm">
                <Avatar
                  profileId={coach.id}
                  src={coach.avatarUrl ?? undefined}
                  name={coach.displayName}
                  size="lg"
                  alt=""
                />
                <div>
                  <p className="font-semibold text-foreground">English with {coach.displayName}</p>
                  <p className="mt-3xs text-ui-sm text-muted">50-minute lesson</p>
                </div>
              </div>
              <dl className="mt-lg border-t border-divider pt-lg">
                <div>
                  <dt className="text-ui-sm text-muted">Date</dt>
                  <dd className="mt-3xs text-body">
                    {formatLessonDate(lesson.startsAt, { locale, timeZone })}
                  </dd>
                </div>
                <div className="mt-md">
                  <dt className="text-ui-sm text-muted">Time</dt>
                  <dd className="mt-3xs text-body">
                    {formatLessonTime(lesson.startsAt, timeFormatPref, { locale, timeZone })}
                  </dd>
                </div>
                <div className="mt-md">
                  <dt className="text-ui-sm text-muted">Timezone</dt>
                  <dd className="mt-3xs text-body">
                    {formatTimeZoneLabel(timeZone, lesson.startsAt)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-xs text-body">Return home to see your upcoming lesson.</p>
          )}
          <Link href="/home" className={cn(buttonVariants({ fullWidth: true }), "mt-lg")}>
            Back to home
          </Link>
        </Card>
      </main>
    </div>
  );
}
