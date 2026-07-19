"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CallPopoverView, toCallPopoverViewProps } from "../call-popover-view";
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
    <CallPopoverView {...toCallPopoverViewProps(context, {
      openChat: () => setChatOpen((open) => !open),
      chatSidebar,
      chatOpen,
      presentation: "screen",
    })} />
  );
}
