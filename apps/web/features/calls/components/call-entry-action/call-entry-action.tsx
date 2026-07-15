"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { CallKind } from "@fish/core/call-state";
import { IconPhone, IconVideo } from "@tabler/icons-react";
import { useState } from "react";
import { useCall } from "../call-provider";

interface CallEntryActionProps {
  recipientId: string;
  recipientName: string;
  label: string;
  variant?: "primary" | "secondary";
  presentation?: "stacked" | "paired";
}

export function CallEntryAction({
  recipientId,
  recipientName,
  label,
  variant = "primary",
  presentation = "stacked",
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
      <div
        role={presentation === "paired" ? "group" : undefined}
        aria-label={
          presentation === "paired" ? `Call ${recipientName}` : undefined
        }
        className={cn(
          "flex flex-col gap-xs",
          presentation === "paired" && "grid grid-cols-2"
        )}
      >
        <Button
          type="button"
          variant={variant}
          fullWidth
          loading={pendingKind === "audio"}
          disabled={disabled}
          onClick={() => void beginCall("audio")}
        >
          {presentation === "paired" ? (
            <span className="inline-flex items-center gap-xs">
              <IconPhone size={20} stroke={1.75} aria-hidden="true" />
              {label}
            </span>
          ) : (
            label
          )}
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
            <IconVideo size={20} stroke={1.75} aria-hidden="true" />
            Video call
          </span>
        </Button>
      </div>
    </div>
  );
}
