"use client";

import { useEffect } from "react";
import { CallPopoverView } from "../call-popover-view";
import { useCall } from "../call-provider";

const terminalStatuses = ["ended", "rejected", "cancelled", "missed", "failed"] as const;

/** Connects the global call lifecycle to its independently renderable view. */
export function CallPopover() {
  const context = useCall();
  const call = context.state.current;
  const terminal = terminalStatuses.includes(call.status as (typeof terminalStatuses)[number]);

  useEffect(() => {
    if (!terminal) return;
    const timeout = window.setTimeout(context.clear, 5_000);
    return () => window.clearTimeout(timeout);
  }, [context.clear, terminal]);

  return (
    <CallPopoverView
      call={call}
      notice={context.notice}
      busy={context.busy}
      audioBlocked={context.audioBlocked}
      localMicrophoneActive={context.localMicrophoneActive}
      localMicrophoneLevel={context.localMicrophoneLevel}
      remoteSpeaking={context.remoteSpeaking}
      localVideoStream={context.localVideoStream}
      remoteVideoTrack={context.remoteVideoTrack}
      videoQualityPreference={context.videoQualityPreference}
      answer={context.answer}
      decline={context.decline}
      cancel={context.cancel}
      end={context.end}
      toggleMute={context.toggleMute}
      toggleCamera={context.toggleCamera}
      hearCall={context.hearCall}
      microphones={context.microphones}
      switchMicrophone={context.switchMicrophone}
      setVideoQualityPreference={context.setVideoQualityPreference}
    />
  );
}
