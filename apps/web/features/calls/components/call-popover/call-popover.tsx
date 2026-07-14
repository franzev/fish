"use client";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MicrophoneVolumeMeter } from "@/components/ui/microphone-volume-meter";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CallSessionState } from "@fish/core/call-state";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconPhone,
  IconPhoneOff,
  IconSettings,
  IconVideo,
  IconVideoOff,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCall } from "../call-provider";

const terminalStatuses = [
  "ended",
  "rejected",
  "cancelled",
  "missed",
  "failed",
] as const;

function getCallCopy(call: CallSessionState) {
  const name = call.counterpartName ?? "your call partner";

  if (call.status === "requestingPermission") {
    return {
      heading: `Preparing your call with ${name}`,
      status: "Your browser may ask for device permission.",
    };
  }
  if (call.status === "ringing" && call.direction === "incoming") {
    return {
      heading: call.kind === "video" ? `Video call from ${name}` : `${name} is calling`,
      status: "Answer when you’re ready.",
    };
  }
  if (call.status === "ringing") {
    return {
      heading: call.kind === "video" ? `Video calling ${name}` : `Calling ${name}`,
      status: "They’ll join when they’re ready.",
    };
  }
  if (call.status === "connecting") {
    return {
      heading: `Connecting with ${name}`,
      status: "This usually takes a moment.",
    };
  }
  if (call.status === "reconnecting") {
    return {
      heading: `Reconnecting with ${name}`,
      status: "The call will continue when the connection returns.",
    };
  }
  if (call.status === "active") {
    return {
      heading: `In call with ${name}`,
      status: call.muted ? "Your microphone is muted." : "Your microphone is on.",
    };
  }
  if (call.status === "missed") {
    return { heading: "You missed this call", status: `The call from ${name} has ended.` };
  }
  if (call.status === "rejected") {
    return { heading: "Call declined", status: "Messages are still available." };
  }
  if (call.status === "cancelled") {
    return { heading: "Call cancelled", status: "Messages are still available." };
  }
  if (call.status === "failed") {
    return { heading: "The call didn’t connect", status: "Messages still work." };
  }
  return { heading: "Call ended", status: "Messages are still available." };
}

export function CallPopover() {
  const {
    state,
    notice,
    busy,
    audioBlocked,
    localMicrophoneActive,
    localMicrophoneLevel,
    remoteSpeaking,
    localVideoStream,
    remoteVideoTrack,
    videoQualityPreference,
    answer,
    decline,
    cancel,
    end,
    toggleMute,
    toggleCamera,
    hearCall,
    clear,
    microphones,
    switchMicrophone,
    setVideoQualityPreference,
  } = useCall();
  const call = state.current;
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [microphoneOptions, setMicrophoneOptions] = useState<
    Array<{ deviceId: string; label: string }>
  >([]);
  const [microphoneId, setMicrophoneId] = useState("");
  const terminal = terminalStatuses.includes(
    call.status as (typeof terminalStatuses)[number]
  );
  const inProgress = ["connecting", "active", "reconnecting"].includes(
    call.status
  );
  const videoStage = call.kind === "video" && inProgress;

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = localVideoStream;
  }, [localVideoStream]);

  useEffect(() => {
    const element = remoteVideo.current;
    if (!element || !remoteVideoTrack || !videoStage) return;
    remoteVideoTrack.attach(element);
    return () => {
      remoteVideoTrack.detach(element);
    };
  }, [remoteVideoTrack, videoStage]);

  useEffect(() => {
    if (!terminal) return;
    const timeout = window.setTimeout(clear, 5_000);
    return () => window.clearTimeout(timeout);
  }, [clear, terminal]);

  const refreshMicrophones = useCallback(async () => {
    const options = await microphones();
    setMicrophoneOptions(options);
    setMicrophoneId((current) =>
      current && options.some((option) => option.deviceId === current)
        ? current
        : options[0]?.deviceId ?? ""
    );
  }, [microphones]);

  function handleSettingsOpenChange(nextOpen: boolean) {
    setSettingsOpen(nextOpen);
    if (nextOpen) void refreshMicrophones();
  }

  useEffect(() => {
    if (!settingsOpen) return;
    const refreshDevices = () => void refreshMicrophones();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        refreshDevices
      );
    };
  }, [refreshMicrophones, settingsOpen]);

  if (call.status === "idle") return null;

  const copy = getCallCopy(call);
  const incoming = call.status === "ringing" && call.direction === "incoming";
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

  return (
    <aside
      aria-labelledby="call-popover-heading"
      className="fixed bottom-mobile-nav-offset left-page right-page z-40 w-auto md:bottom-page md:left-page md:right-auto md:w-full md:max-w-call-popover"
    >
      <Card className="overflow-hidden border border-divider p-0">
        {videoStage && (
          <div className="relative aspect-video overflow-hidden bg-surface-2">
            {!remoteVideoTrack && (
              <div className="flex h-full flex-col items-center justify-center gap-xs text-body">
                <IconVideoOff size={24} stroke={1.75} aria-hidden="true" />
                <span className="max-w-full truncate px-md text-ui-sm">
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
              className={cn(
                "absolute inset-0 h-full w-full object-cover",
                remoteVideoTrack ? "block" : "hidden"
              )}
            />
            <div className="absolute bottom-xs right-xs aspect-video w-full max-w-call-preview overflow-hidden rounded-control border border-divider bg-bg">
              {!localVideoStream && (
                <div className="flex h-full items-center justify-center text-muted">
                  <IconVideoOff size={16} stroke={1.75} aria-label="Your camera is off" />
                </div>
              )}
              <video
                ref={localVideo}
                aria-label="Your video preview"
                autoPlay
                muted
                playsInline
                className={cn(
                  "h-full w-full -scale-x-100 object-cover",
                  localVideoStream ? "block" : "hidden"
                )}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-md p-md">
          <div className="flex min-w-0 items-center gap-sm">
            <span className="flex size-control shrink-0 items-center justify-center rounded-pill bg-surface-2 text-foreground">
              {call.kind === "video" ? (
                <IconVideo size={20} stroke={1.75} aria-hidden="true" />
              ) : (
                <IconPhone size={20} stroke={1.75} aria-hidden="true" />
              )}
            </span>
            <div
              className="min-w-0 flex-1"
              role="status"
              aria-live={incoming ? "assertive" : "polite"}
              aria-atomic="true"
            >
              <h2
                id="call-popover-heading"
                className="truncate font-sans text-ui-md font-semibold text-foreground"
              >
                {copy.heading}
              </h2>
              <p className="truncate text-ui-xs text-body">
                {copy.status}
              </p>
            </div>
          </div>

          {call.kind === "audio" && ["active", "reconnecting"].includes(call.status) && (
            <div className="grid grid-cols-2 gap-xs text-left">
              <div className="flex min-w-0 items-center gap-xs rounded-control bg-surface-2 px-sm py-xs">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-xs shrink-0 rounded-pill",
                    localMicrophoneActive && !call.muted ? "bg-primary" : "bg-muted"
                  )}
                />
                <span className="truncate text-ui-xs text-body">
                  {call.muted ? "Muted" : localMicrophoneActive ? "Voice detected" : "Listening"}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-xs rounded-control bg-surface-2 px-sm py-xs">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-xs shrink-0 rounded-pill",
                    remoteSpeaking ? "bg-primary" : "bg-muted"
                  )}
                />
                <span className="truncate text-ui-xs text-body">
                  {remoteSpeaking ? "Speaking" : "Listening"}
                </span>
              </div>
            </div>
          )}

          {notice && (
            <Alert tone="notice" className="text-left">
              {notice}
            </Alert>
          )}

          {audioBlocked && call.status === "active" && (
            <div className="flex flex-col gap-xs">
              <Alert tone="notice" className="text-left">
                Your browser is waiting for permission to play the call.
              </Alert>
              <Button variant="secondary" fullWidth onClick={() => void hearCall()}>
                Hear call
              </Button>
            </div>
          )}

          {incoming && (
            <div className="flex flex-col gap-xs">
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
            </div>
          )}

          {call.status === "ringing" && call.direction === "outgoing" && (
            <Button
              variant="secondary"
              fullWidth
              loading={busy}
              onClick={() => void cancel()}
            >
              Cancel call
            </Button>
          )}

          {inProgress && (
            <Tooltip.Provider delay={400} closeDelay={0}>
              <div className="flex items-center justify-center gap-xs">
                {call.status !== "connecting" && (
                  <>
                    <span className="inline-flex items-center gap-2xs">
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
                                <IconMicrophoneOff
                                  data-testid="microphone-off-icon"
                                  size={20}
                                  stroke={1.75}
                                  aria-hidden="true"
                                />
                              ) : (
                                <IconMicrophone
                                  data-testid="microphone-on-icon"
                                  size={20}
                                  stroke={1.75}
                                  aria-hidden="true"
                                />
                              )}
                            </Button>
                          }
                        />
                        <Tooltip.Portal>
                          <Tooltip.Positioner side="top" sideOffset={4} className="z-50">
                            <Tooltip.Popup role="tooltip" className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg">
                              {call.muted ? "Unmute" : "Mute"}
                            </Tooltip.Popup>
                          </Tooltip.Positioner>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                      {call.kind === "video" && (
                        <MicrophoneVolumeMeter
                          level={call.muted ? 0 : localMicrophoneLevel}
                          active={!call.muted && localMicrophoneActive}
                        />
                      )}
                    </span>

                    {call.kind === "video" && (
                      <Tooltip.Root>
                        <Tooltip.Trigger
                          render={
                            <Button
                              variant="secondary"
                              aria-label={call.cameraEnabled ? "Turn camera off" : "Turn camera on"}
                              onClick={() => void toggleCamera()}
                              className="min-w-control px-0"
                            >
                              {call.cameraEnabled ? (
                                <IconVideo
                                  data-testid="camera-on-icon"
                                  size={20}
                                  stroke={1.75}
                                  aria-hidden="true"
                                />
                              ) : (
                                <IconVideoOff
                                  data-testid="camera-off-icon"
                                  size={20}
                                  stroke={1.75}
                                  aria-hidden="true"
                                />
                              )}
                            </Button>
                          }
                        />
                        <Tooltip.Portal>
                          <Tooltip.Positioner side="top" sideOffset={4} className="z-50">
                            <Tooltip.Popup role="tooltip" className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg">
                              {call.cameraEnabled ? "Turn camera off" : "Turn camera on"}
                            </Tooltip.Popup>
                          </Tooltip.Positioner>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    )}

                    <Popover.Root
                      open={settingsOpen}
                      onOpenChange={(nextOpen) => void handleSettingsOpenChange(nextOpen)}
                    >
                      <Tooltip.Root>
                        <Tooltip.Trigger
                          render={
                            <Popover.Trigger
                              aria-label="Call settings"
                              className={cn(
                                buttonVariants({ variant: "secondary" }),
                                "min-w-control px-0"
                              )}
                            >
                              <IconSettings size={20} stroke={1.75} aria-hidden="true" />
                            </Popover.Trigger>
                          }
                        />
                        <Tooltip.Portal>
                          <Tooltip.Positioner side="top" sideOffset={4} className="z-50">
                            <Tooltip.Popup role="tooltip" className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg">
                              Call settings
                            </Tooltip.Popup>
                          </Tooltip.Positioner>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                      <Popover.Portal>
                        <Popover.Positioner side="top" align="end" sideOffset={4} className="z-50">
                          <Popover.Popup
                            initialFocus={false}
                            className="call-settings-popover rounded-control border border-divider bg-surface p-md outline-none"
                          >
                            <div className="flex flex-col gap-md">
                              {microphoneSelect ?? (
                                <p role="status" className="text-ui-sm text-body">
                                  Finding microphones…
                                </p>
                              )}
                              {call.kind === "video" && (
                                <fieldset className="flex flex-col gap-xs text-left">
                                  <legend className="text-ui-sm font-semibold text-foreground">
                                    Video quality
                                  </legend>
                                  <div className="flex min-h-control items-center justify-between gap-sm">
                                    <span className="flex min-w-0 flex-col gap-2xs">
                                      <span className="text-ui-sm text-foreground">Use less data</span>
                                      <span id="video-quality-description" className="text-ui-xs text-body">
                                        Lowers video quality to help on slower connections.
                                      </span>
                                    </span>
                                    <Switch
                                      aria-label="Use less data"
                                      aria-describedby="video-quality-description"
                                      checked={videoQualityPreference === "data-saver"}
                                      onCheckedChange={(checked) =>
                                        setVideoQualityPreference(checked ? "data-saver" : "auto")
                                      }
                                    />
                                  </div>
                                </fieldset>
                              )}
                            </div>
                          </Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    </Popover.Root>
                  </>
                )}

                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        variant="secondary"
                        aria-label="End call"
                        loading={busy}
                        onClick={() => void end()}
                        className="min-w-control bg-error px-0 text-on-primary hover:bg-error active:bg-error"
                      >
                        <IconPhoneOff size={20} stroke={1.75} aria-hidden="true" />
                      </Button>
                    }
                  />
                  <Tooltip.Portal>
                    <Tooltip.Positioner side="top" sideOffset={4} className="z-50">
                      <Tooltip.Popup role="tooltip" className="rounded-control bg-foreground px-xs py-2xs text-ui-2xs text-bg">
                        End call
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </div>
            </Tooltip.Provider>
          )}
        </div>
      </Card>
    </aside>
  );
}
