"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCall } from "@/features/calls";
import { useState } from "react";

interface LessonCallActionProps {
  coachId: string;
  coachName: string;
}

export function LessonCallAction({ coachId, coachName }: LessonCallActionProps) {
  const { startCall, busy, notice } = useCall();
  const [pending, setPending] = useState(false);

  async function joinLesson() {
    setPending(true);
    await startCall(coachId, coachName, "video");
    setPending(false);
  }

  return (
    <div className="mt-lg flex flex-col gap-xs">
      {notice && <Alert tone="notice">{notice}</Alert>}
      <Button
        type="button"
        fullWidth
        loading={pending}
        disabled={busy}
        onClick={() => void joinLesson()}
      >
        Join lesson
      </Button>
    </div>
  );
}
