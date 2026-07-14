"use client";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  IconMessages,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhone,
  IconPhoneOff,
  IconVideo,
  IconVideoOff,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCall } from "../call-provider";

export function CallScreen({
  callId,
  chatSidebar,
}: {
  callId: string;
  chatSidebar?: ReactNode;
}) {
  const router = useRouter();
  const {
    state,
    homeHref,
    notice,
    busy,
    audioBlocked,
    localMicrophoneActive,
    remoteSpeaking,
    localVideoStream,
    remoteVideoTrack,
    answer,
    decline,
    cancel,
    end,
    toggleMute,
    toggleCamera,
    hearCall,
    loadCall,
    leaveSurface,
    clear,
    microphones,
    switchMicrophone,
  } = useCall();
  const call = state.current;
  const loadedId = useRef<string | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [microphoneOptions, setMicrophoneOptions] = useState<
    Array<{ deviceId: string; label: string }>
  >([]);
  const [microphoneId, setMicrophoneId] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (loadedId.current === callId) return;
    loadedId.current = callId;
    void loadCall(callId);
  }, [callId, loadCall]);

  useEffect(() => () => leaveSurface(), [leaveSurface]);

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = localVideoStream;
  }, [localVideoStream]);

  async function handleAudioSettingsOpenChange(nextOpen: boolean) {
    setAudioSettingsOpen(nextOpen);
    if (!nextOpen || microphoneOptions.length > 0) return;
    const options = await microphones();
    setMicrophoneOptions(options);
    if (options[0]) setMicrophoneId(options[0].deviceId);
  }

  const terminal = [
    "ended",
    "rejected",
    "cancelled",
    "missed",
    "failed",
  ].includes(call.status);
  const inProgress = ["connecting", "active", "reconnecting"].includes(
    call.status
  );
  const videoStage = call.kind === "video" && inProgress;

  useEffect(() => {
    const element = remoteVideo.current;
    if (!element || !remoteVideoTrack || !videoStage) return;
    remoteVideoTrack.attach(element);
    return () => {
      remoteVideoTrack.detach(element);
    };
  }, [remoteVideoTrack, videoStage]);

  const heading = call.status === "ringing"
    ? call.direction === "incoming"
      ? call.kind === "video"
        ? `Video call from ${call.counterpartName ?? "your call partner"}`
        : `${call.counterpartName ?? "Your call partner"} is calling`
      : call.kind === "video"
      ? `Video calling ${call.counterpartName ?? "your call partner"}`
      : `Calling ${call.counterpartName ?? "your call partner"}`
    : call.status === "connecting"
    ? "Connecting you now"
    : call.status === "reconnecting"
    ? "Connection is coming back"
    : call.status === "active"
    ? `${call.kind === "video" ? "Video call" : "In call"} with ${
        call.counterpartName ?? "your call partner"
      }`
    : call.status === "missed"
    ? "You missed this call"
    : call.status === "rejected"
    ? "Call declined"
    : call.status === "failed"
    ? "The call didn’t connect"
    : "Call ended";
  const subline = call.status === "ringing" && call.direction === "outgoing"
    ? "They’ll join when they’re ready."
    : call.status === "connecting"
    ? "Keep this page open for a moment."
    : call.status === "reconnecting"
    ? "Your call will continue when the connection returns."
    : call.status === "active"
    ? call.muted
      ? "Your microphone is muted."
      : "Your microphone is on."
    : terminal
    ? "Messages are still available."
    : "Preparing your call.";

  function leave() {
    clear();
    router.push(homeHref);
  }

  const microphoneSelect = microphoneOptions.length > 0 && (
    <label className="flex w-full flex-col gap-xs text-left text-ui-sm text-body">
      Microphone
      <select
        className="min-h-control w-full rounded-control bg-surface-2 px-sm text-ui text-foreground"
        value={microphoneId}
        onChange={(event) => {
          setMicrophoneId(event.target.value);
          void switchMicrophone(event.target.value);
        }}
      >
        {microphoneOptions.map((option) => (
          <option key={option.deviceId} value={option.deviceId}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  if (videoStage) {
    /* An in-progress video call owns the whole viewport: the other person
       fills the stage, your preview sits flush in the bottom-right corner,
       and everything else — who you're talking to, notices, and controls —
       lives in one dock at the bottom. */
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <div
            className={cn(
              "relative min-h-0 flex-1 overflow-hidden bg-surface-2",
              chatSidebar && chatOpen && "hidden lg:block"
            )}
          >
            {!remoteVideoTrack && (
              <div className="flex h-full flex-col items-center justify-center gap-xs text-body">
                <IconVideoOff size={28} aria-hidden="true" />
                <span className="text-ui-sm">
                  {call.counterpartName ?? "Your call partner"}&apos;s camera is off
                </span>
              </div>
            )}
            <video
              ref={remoteVideo}
              aria-label={`${call.counterpartName ?? "Your call partner"} video`}
              autoPlay
              muted
              playsInline
              className={`absolute inset-0 h-full w-full object-cover ${
                remoteVideoTrack ? "block" : "hidden"
              }`}
            />
            <div className="absolute bottom-0 right-0 aspect-video w-1/3 overflow-hidden bg-bg sm:w-1/4 lg:w-1/5">
              {!localVideoStream && (
                <div className="flex h-full items-center justify-center gap-2xs text-ui-xs text-muted">
                  <IconVideoOff size={16} aria-hidden="true" />
                  Camera off
                </div>
              )}
              <video
                ref={localVideo}
                aria-label="Your video preview"
                autoPlay
                muted
                playsInline
                className={`h-full w-full -scale-x-100 object-cover ${
                  localVideoStream ? "block" : "hidden"
                }`}
              />
            </div>
          </div>

          {chatSidebar && (
            <aside
              id="call-messages"
              aria-label={`Messages with ${
                call.counterpartName ?? "your call partner"
              }`}
              className={cn(
                "min-h-0 w-full flex-col border-l border-divider bg-surface lg:w-chat-preview lg:shrink-0",
                chatOpen ? "flex" : "hidden"
              )}
            >
              <div className="flex h-chat-header shrink-0 flex-col justify-center border-b border-divider px-md">
                <h2 className="font-sans text-ui-md font-semibold text-foreground">
                  Messages
                </h2>
                <p className="text-ui-xs text-muted">
                  {call.counterpartName ?? "Your call partner"}
                </p>
              </div>
              <div className="flex min-h-0 flex-1">{chatSidebar}</div>
            </aside>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-xs px-page py-sm">
          {notice && (
            <Alert tone="notice" className="text-left">
              {notice}
            </Alert>
          )}
          {audioBlocked && call.status === "active" && (
            <>
              <Alert tone="notice" className="text-left">
                Your browser is waiting for permission to play the call.
              </Alert>
              <Button variant="secondary" onClick={() => void hearCall()}>
                Hear call
              </Button>
            </>
          )}
          <Tooltip.Provider delay={400} closeDelay={0}>
            <div className="flex flex-wrap items-center justify-center gap-xs">
              {chatSidebar && (
                <Button
                  variant="secondary"
                  aria-label={chatOpen ? "Close chat" : "Open chat"}
                  aria-controls="call-messages"
                  aria-expanded={chatOpen}
                  aria-pressed={chatOpen}
                  onClick={() => setChatOpen((open) => !open)}
                  className={cn(
                    "min-w-control px-0",
                    chatOpen && "bg-surface-3"
                  )}
                >
                  <IconMessages size={20} aria-hidden="true" />
                </Button>
              )}
              {call.status !== "connecting" && (
                <>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant="secondary"
                          aria-label={call.muted ? "Unmute" : "Mute"}
                          onClick={() => void toggleMute()}
                          className="min-w-control px-0"
                        >
                          {call.muted ? (
                            <IconMicrophone size={20} aria-hidden="true" />
                          ) : (
                            <IconMicrophoneOff size={20} aria-hidden="true" />
                          )}
                        </Button>
                      }
                    />
                    <Tooltip.Portal>
                      <Tooltip.Positioner side="top" sideOffset={4} className="z-30">
                        <Tooltip.Popup
                          role="tooltip"
                          className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg"
                        >
                          {call.muted ? "Unmute" : "Mute"}
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant="secondary"
                          aria-label={call.cameraEnabled
                            ? "Turn camera off"
                            : "Turn camera on"}
                          onClick={() => void toggleCamera()}
                          className="min-w-control px-0"
                        >
                          {call.cameraEnabled ? (
                            <IconVideoOff size={20} aria-hidden="true" />
                          ) : (
                            <IconVideo size={20} aria-hidden="true" />
                          )}
                        </Button>
                      }
                    />
                    <Tooltip.Portal>
                      <Tooltip.Positioner side="top" sideOffset={4} className="z-30">
                        <Tooltip.Popup
                          role="tooltip"
                          className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg"
                        >
                          {call.cameraEnabled
                            ? "Turn camera off"
                            : "Turn camera on"}
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                  <Popover.Root
                    open={audioSettingsOpen}
                    onOpenChange={(nextOpen) =>
                      void handleAudioSettingsOpenChange(nextOpen)
                    }
                  >
                    <Popover.Trigger
                      className={buttonVariants({ variant: "ghost" })}
                    >
                      Audio settings
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Positioner
                        side="top"
                        align="end"
                        sideOffset={4}
                        className="z-50"
                      >
                        <Popover.Popup
                          initialFocus={false}
                          className="w-audio-settings rounded-control border border-divider bg-surface p-md outline-none"
                        >
                          {microphoneSelect ?? (
                            <p role="status" className="text-ui-sm text-body">
                              Finding microphones…
                            </p>
                          )}
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                </>
              )}
              <Button
                aria-label="End call"
                variant="secondary"
                loading={busy}
                onClick={() => void end()}
                className="min-w-control bg-error px-0 text-on-primary hover:bg-error active:bg-error"
              >
                <IconPhoneOff size={20} aria-hidden="true" />
              </Button>
            </div>
          </Tooltip.Provider>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center gap-lg py-xl">
      <Card className="flex flex-col items-center gap-lg py-2xl text-center">
        <span className="flex min-h-control min-w-control items-center justify-center rounded-pill bg-surface-2 text-foreground">
          <IconPhone size={28} stroke={1.75} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-xs">
          <h1 className="text-heading-sm">{heading}</h1>
          <p className="text-body">{subline}</p>
        </div>

        {["active", "reconnecting"].includes(call.status) && (
          <div className="grid w-full gap-xs text-left sm:grid-cols-2">
            <div className="flex items-center gap-sm rounded-control bg-surface-2 px-sm py-xs">
              <span
                aria-hidden="true"
                className={`size-xs shrink-0 rounded-pill ${
                  localMicrophoneActive && !call.muted
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
              <span className="flex flex-col gap-3xs">
                <span className="text-ui-sm font-semibold text-foreground">
                  Your microphone
                </span>
                <span className="text-ui-xs text-body">
                  {call.muted
                    ? "Muted"
                    : localMicrophoneActive
                    ? "Picking up your voice"
                    : "No voice detected"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-sm rounded-control bg-surface-2 px-sm py-xs">
              <span
                aria-hidden="true"
                className={`size-xs shrink-0 rounded-pill ${
                  remoteSpeaking ? "bg-primary" : "bg-muted"
                }`}
              />
              <span className="flex flex-col gap-3xs">
                <span className="text-ui-sm font-semibold text-foreground">
                  {call.counterpartName ?? "Your call partner"}
                </span>
                <span className="text-ui-xs text-body">
                  {remoteSpeaking ? "Speaking" : "Listening"}
                </span>
              </span>
            </div>
          </div>
        )}

        {notice && (
          <Alert tone="notice" className="w-full text-left">
            {notice}
          </Alert>
        )}
        {audioBlocked && call.status === "active" && (
          <div className="flex w-full flex-col gap-xs">
            <Alert tone="notice" className="text-left">
              Your browser is waiting for permission to play the call.
            </Alert>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => void hearCall()}
            >
              Hear call
            </Button>
          </div>
        )}

        <div className="flex w-full flex-col gap-xs">
          {call.status === "ringing" && call.direction === "incoming" && (
            <>
              <Button fullWidth loading={busy} onClick={() => void answer()}>
                {call.kind === "video" ? "Answer video call" : "Answer call"}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                disabled={busy}
                onClick={() => void decline()}
              >
                Not now
              </Button>
            </>
          )}
          {call.status === "ringing" && call.direction === "outgoing" && (
            <Button fullWidth loading={busy} onClick={() => void cancel()}>
              Cancel call
            </Button>
          )}
          {inProgress && (
            <>
              {call.status !== "connecting" && (
                <>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => void toggleMute()}
                  >
                    {call.muted ? (
                      <span className="inline-flex items-center gap-xs">
                        <IconMicrophone size={20} aria-hidden="true" />
                        Unmute
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-xs">
                        <IconMicrophoneOff size={20} aria-hidden="true" />
                        Mute
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    fullWidth
                    aria-expanded={audioSettingsOpen}
                    onClick={() =>
                      void handleAudioSettingsOpenChange(!audioSettingsOpen)
                    }
                  >
                    Audio settings
                  </Button>
                  {audioSettingsOpen && microphoneSelect}
                </>
              )}
              <Button fullWidth loading={busy} onClick={() => void end()}>
                End call
              </Button>
            </>
          )}
          {terminal && (
            <Button fullWidth onClick={leave}>
              Back to home
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
