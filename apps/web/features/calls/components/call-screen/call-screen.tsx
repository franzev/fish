"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CallPopoverView } from "../call-popover-view";
import { useCall } from "../call-provider";

export interface CallScreenProps {
  callId: string;
  chatSidebar?: ReactNode;
}

/** Owns the dedicated call route and keeps its conversation beside the video. */
export function CallScreen({ callId, chatSidebar }: CallScreenProps) {
  const context = useCall();
  const call = context.state.current;
  const [chatOpen, setChatOpen] = useState(false);

  if (call.callId !== callId) return null;

  return (
    <CallPopoverView
      call={call}
      openChat={() => setChatOpen((open) => !open)}
      chatSidebar={chatSidebar}
      chatOpen={chatOpen}
      presentation="screen"
      notice={context.notice}
      busy={context.busy}
      audioBlocked={context.audioBlocked}
      localMicrophoneActive={context.localMicrophoneActive}
      localMicrophoneLevel={context.localMicrophoneLevel}
      remoteSpeaking={context.remoteSpeaking}
      remoteMicrophoneLevel={context.remoteMicrophoneLevel}
      remoteMuted={context.remoteMuted}
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
