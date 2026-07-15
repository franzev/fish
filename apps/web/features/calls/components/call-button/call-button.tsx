"use client";

import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";
import type { CallKind } from "@fish/core/call-state";
import { Tooltip } from "@base-ui/react/tooltip";
import { IconPhone, IconVideo } from "@tabler/icons-react";
import { useCall } from "../call-provider";

export interface CallButtonProps {
  recipientId: string;
  recipientName: string;
  kind: CallKind;
  presentation?: "icon" | "labeled";
}

/** Starts a voice or video call from compact conversation surfaces. */
export function CallButton({
  recipientId,
  recipientName,
  kind,
  presentation = "icon",
}: CallButtonProps) {
  const { startCall, busy } = useCall();
  const isVideo = kind === "video";
  const label = `${isVideo ? "Video call" : "Voice call"} ${recipientName}`;
  const CallIcon = isVideo ? IconVideo : IconPhone;

  if (presentation === "labeled") {
    return (
      <Button
        type="button"
        variant="secondary"
        fullWidth
        disabled={busy}
        aria-label={label}
        onClick={() => void startCall(recipientId, recipientName, kind)}
      >
        <span className="inline-flex items-center gap-xs">
          <CallIcon size={20} stroke={1.75} aria-hidden="true" />
          {isVideo ? "Video" : "Call"}
        </span>
      </Button>
    );
  }

  return (
    <Tooltip.Provider delay={400} closeDelay={0}>
      <TooltipIconButton
        type="button"
        label={label}
        tooltipSide="bottom"
        disabled={busy}
        className="shrink-0"
        onClick={() => void startCall(recipientId, recipientName, kind)}
        icon={<CallIcon size={20} stroke={1.75} aria-hidden="true" />}
      />
    </Tooltip.Provider>
  );
}
