import { Card } from "@/components/ui/card";
import type { UpcomingLessonData } from "../../contracts";
import { formatLessonDate, formatLessonTime, formatTimeZoneLabel, isLessonJoinable } from "../../format";
import { LessonCallAction } from "../lesson-call-action";

interface UpcomingLessonProps {
  data: UpcomingLessonData;
  now?: Date;
}

export function UpcomingLesson({ data, now = new Date() }: UpcomingLessonProps) {
  const joinable = isLessonJoinable(data.lesson, now);
  return (
    <Card>
      <p className="text-ui-sm text-muted">Your next lesson</p>
      <h2 className="mt-xs text-heading-sm">
        {formatLessonDate(data.lesson.startsAt, data)}
      </h2>
      <p className="mt-xs text-body">
        {formatLessonTime(data.lesson.startsAt, data.timeFormatPref, data)} with{" "}
        {data.coach.displayName}
      </p>
      <p className="mt-sm text-ui-sm text-muted">
        50 minutes · {formatTimeZoneLabel(data.timeZone, data.lesson.startsAt)}
      </p>
      {joinable && (
        <LessonCallAction coachId={data.coach.id} coachName={data.coach.displayName} />
      )}
    </Card>
  );
}
