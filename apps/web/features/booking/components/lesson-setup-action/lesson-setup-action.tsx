"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isLessonJoinable } from "../../format";

interface LessonSetupActionProps {
  lessonId: string;
  startsAt: string;
  endsAt: string;
  joinWindowMinutes: number;
  initialNow: string;
}

export function LessonSetupAction({
  lessonId,
  startsAt,
  endsAt,
  joinWindowMinutes,
  initialNow,
}: LessonSetupActionProps) {
  const offset = useRef(0);
  const [now, setNow] = useState(() => new Date(initialNow));

  useEffect(() => {
    offset.current = new Date(initialNow).getTime() - Date.now();
    const timer = window.setInterval(() => {
      setNow(new Date(Date.now() + offset.current));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [initialNow]);

  if (now.getTime() >= new Date(endsAt).getTime()) return null;
  const joinable = isLessonJoinable(
    { startsAt, endsAt },
    joinWindowMinutes,
    now
  );

  return (
    <Link
      href={`/book/${lessonId}/setup`}
      className={cn(buttonVariants({ fullWidth: true }), "mt-lg")}
    >
      {joinable ? "Join lesson" : "Check camera and microphone"}
    </Link>
  );
}
