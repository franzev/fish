"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
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
  return (
    <div className="flex flex-col gap-xs">
      {notice && <Alert tone="notice">{notice}</Alert>}
      <Button
        type="button"
        fullWidth
        loading={busy}
        onClick={() => void startCall(recipientId, recipientName)}
      >
        {label}
      </Button>
    </div>
  );
}
