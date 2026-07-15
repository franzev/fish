"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CallPopoverView } from "../call-popover-view";
import { useCall } from "../call-provider";

const terminalStatuses = ["ended", "rejected", "cancelled", "missed", "failed"] as const;

interface CallChatPreview {
  conversationId: string;
  participant: { id: string };
}

interface CallPopoverProps {
  loadChatPreviewsAction?: (input: unknown) => Promise<{
    status: "sent" | "notice";
    previews?: CallChatPreview[];
  }>;
}

/** Connects the global call lifecycle to its independently renderable view. */
export function CallPopover({ loadChatPreviewsAction }: CallPopoverProps) {
  const context = useCall();
  const call = context.state.current;
  const pathname = usePathname();
  const router = useRouter();
  const navigatingTo = useRef<string | null>(null);
  const [compactCallId, setCompactCallId] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  const terminal = terminalStatuses.includes(call.status as (typeof terminalStatuses)[number]);
  const videoInProgress = call.kind === "video" && ["connecting", "active", "reconnecting"].includes(call.status);
  const callPath = call.callId ? `/calls/${call.callId}` : null;
  const onCallScreen = callPath === pathname;
  const compactVideoCall = compactCallId === call.callId;

  useEffect(() => {
    if (!videoInProgress || !callPath || compactVideoCall) return;
    if (pathname === callPath) {
      navigatingTo.current = null;
      return;
    }
    if (navigatingTo.current === callPath) return;
    navigatingTo.current = callPath;
    router.push(callPath);
  }, [callPath, compactVideoCall, pathname, router, videoInProgress]);

  useEffect(() => {
    if (!terminal) return;
    const timeout = window.setTimeout(context.clear, 5_000);
    return () => window.clearTimeout(timeout);
  }, [context.clear, terminal]);

  useEffect(() => {
    if (!terminal || !pathname.startsWith("/calls/")) return;
    router.replace("/home");
  }, [pathname, router, terminal]);

  async function openChat() {
    if (openingChat) return;
    setOpeningChat(true);
    let href = "/messages";

    try {
      const result = await loadChatPreviewsAction?.({});
      const conversation = result?.previews?.find(
        (preview) => preview.participant.id === call.counterpartId
      );
      if (conversation) href = `/messages/${conversation.conversationId}`;
    } catch {
      href = "/messages";
    } finally {
      setCompactCallId(call.callId);
      setOpeningChat(false);
      router.push(href);
    }
  }

  if (videoInProgress && !onCallScreen && !compactVideoCall) return null;
  if (pathname.startsWith("/calls/")) return null;

  return (
    <CallPopoverView
      key={call.callId ?? "idle"}
      call={call}
      openChat={openChat}
      openingChat={openingChat}
      presentation="popover"
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
