"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { CallKind } from "@fish/core/call-state";
import { IconVideo } from "@tabler/icons-react";
import { useState } from "react";
import { useCall } from "../call-provider";

interface CallEntryActionProps {
  recipientId: string;
  recipientName: string;
  label: string;
}

export function CallEntryAction({
  recipientId,
  recipientName,
  label,
}: CallEntryActionProps) {
  const { startCall, busy, notice } = useCall();
  const [pendingKind, setPendingKind] = useState<CallKind | null>(null);

  async function beginCall(kind: CallKind) {
    setPendingKind(kind);
    await startCall(recipientId, recipientName, kind);
    setPendingKind(null);
  }

  const disabled = busy || pendingKind !== null;
  return (
    <div className="flex flex-col gap-xs">
      {notice && <Alert tone="notice">{notice}</Alert>}
      <Button
        type="button"
        fullWidth
        loading={pendingKind === "audio"}
        disabled={disabled}
        onClick={() => void beginCall("audio")}
      >
        {label}
      </Button>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        loading={pendingKind === "video"}
        disabled={disabled}
        aria-label={`Video call ${recipientName}`}
        onClick={() => void beginCall("video")}
      >
        <span className="inline-flex items-center gap-xs">
          <IconVideo size={20} aria-hidden="true" />
          Video call
        </span>
      </Button>
    </div>
  );
}
