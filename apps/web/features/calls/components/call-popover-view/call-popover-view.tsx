"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MediaDeviceSelect } from "@/components/ui/media-device-select";
import { MicrophoneVolumeMeter } from "@/components/ui/microphone-volume-meter";
import { Switch } from "@/components/ui/switch";
import { IconButton } from "@/components/ui/icon-button";
import { useMobileLayout } from "@/hooks/use-mobile-layout";
import { cn } from "@/lib/utils";
import type { CallSessionState } from "@fish/core/call-state";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  IconMessages,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhone,
  IconPhoneOff,
  IconSettings,
  IconVideo,
  IconVideoOff,
} from "@tabler/icons-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CallContextValue } from "../call-provider";
import { DraggableVideoPreview } from "../draggable-video-preview";

export interface CallPopoverViewProps extends Omit<
  CallContextValue,
  "state" | "startCall" | "startLessonCall" | "clear"
> {
  call: CallSessionState;
  openChat: () => void | Promise<void>;
  openingChat?: boolean;
  chatSidebar?: ReactNode;
  chatOpen?: boolean;
  presentation?: "popover" | "screen";
}

function getCallCopy(call: CallSessionState) {
  const name = call.counterpartName ?? "your call partner";
  if (call.status === "requestingPermission") return { heading: `Preparing your call with ${name}`, status: "Your browser may ask for device permission." };
  if (call.status === "ringing" && call.direction === "incoming") return {
    heading: `${call.counterpartName ?? "Your call partner"} is calling`,
    status: `${call.kind === "video" ? "Video" : "Audio"} call. Answer when you’re ready.`,
  };
  if (call.status === "ringing") return {
    heading: `Calling ${name}`,
    status: `${call.kind === "video" ? "Video" : "Audio"} call. They’ll join when they’re ready.`,
  };
  if (call.status === "connecting") return { heading: `Connecting with ${name}`, status: "This usually takes a moment." };
  if (call.status === "reconnecting") return { heading: `Reconnecting with ${name}`, status: "The call will continue when the connection returns." };
  if (call.status === "active") return { heading: `In call with ${name}`, status: call.muted ? "Your microphone is muted." : "Your microphone is on." };
  if (call.status === "missed") return { heading: "You missed this call", status: `The call from ${name} has ended.` };
  if (call.status === "rejected") return { heading: "Call declined", status: "Messages are still available." };
  if (call.status === "cancelled") return { heading: "Call cancelled", status: "Messages are still available." };
  if (call.status === "failed") return { heading: "The call didn’t connect", status: "Messages still work." };
  return { heading: "Call ended", status: "Messages are still available." };
}

export function CallPopoverView({
  call,
  openChat,
  openingChat = false,
  chatSidebar,
  chatOpen = false,
  notice,
  busy,
  audioBlocked,
  localMicrophoneActive,
  localMicrophoneLevel,
  remoteSpeaking,
  remoteMicrophoneLevel,
  remoteMuted,
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
  microphones,
  switchMicrophone,
  setVideoQualityPreference,
  presentation = "popover",
}: CallPopoverViewProps) {
  const mobile = useMobileLayout();
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const videoStageRef = useRef<HTMLDivElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [microphoneOptions, setMicrophoneOptions] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [microphoneId, setMicrophoneId] = useState("");
  const pendingIncomingActionRef = useRef<"answer" | "decline" | null>(null);
  const [pendingIncomingAction, setPendingIncomingAction] = useState<"answer" | "decline" | null>(null);
  const pendingOutgoingCancelRef = useRef(false);
  const [pendingOutgoingCancel, setPendingOutgoingCancel] = useState(false);
  const inProgress = ["connecting", "active", "reconnecting"].includes(call.status);
  const screen = presentation === "screen";
  const videoStage = screen && call.kind === "video" && inProgress;
  const incoming = call.status === "ringing" && call.direction === "incoming";
  const outgoingRinging = call.status === "ringing" && call.direction === "outgoing";
  const callPrompt = incoming || outgoingRinging;
  const copy = getCallCopy(call);

  useEffect(() => {
    const element = remoteVideo.current;
    if (!element || !remoteVideoTrack || !videoStage) return;
    remoteVideoTrack.attach(element);
    return () => {
      remoteVideoTrack.detach(element);
    };
  }, [remoteVideoTrack, videoStage]);

  const refreshMicrophones = useCallback(async () => {
    const options = await microphones();
    setMicrophoneOptions(options);
    setMicrophoneId((current) => current && options.some((option) => option.deviceId === current) ? current : options[0]?.deviceId ?? "");
  }, [microphones]);

  useEffect(() => {
    if (!settingsOpen) return;
    const refreshDevices = () => void refreshMicrophones();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshMicrophones, settingsOpen]);

  const runIncomingAction = useCallback(async (
    action: "answer" | "decline",
    operation: () => Promise<void>
  ) => {
    if (busy || pendingIncomingActionRef.current) return;
    pendingIncomingActionRef.current = action;
    setPendingIncomingAction(action);
    try {
      await operation();
    } finally {
      pendingIncomingActionRef.current = null;
      setPendingIncomingAction(null);
    }
  }, [busy]);

  const runOutgoingCancel = useCallback(async () => {
    if (busy || pendingOutgoingCancelRef.current) return;
    pendingOutgoingCancelRef.current = true;
    setPendingOutgoingCancel(true);
    try {
      await cancel();
    } finally {
      pendingOutgoingCancelRef.current = false;
      setPendingOutgoingCancel(false);
    }
  }, [busy, cancel]);

  if (call.status === "idle") return null;

  const Root = screen ? "section" : "aside";

  return (
    <Root
      aria-labelledby="call-popover-heading"
      className={cn(
        screen
          ? "fixed inset-0 z-40 h-dvh w-full bg-bg"
          : "call-popover-width mobile-call-popover-safe left-page md:bottom-page",
        !screen && "fixed z-40"
      )}
    >
      <Card className={cn(
        "overflow-hidden p-0",
        screen
          ? "flex h-full w-full flex-col rounded-none border-0"
          : "border border-divider"
      )}>
        {videoStage && (
          <div className="flex min-h-0 flex-1">
            <div ref={videoStageRef} className={cn(
              "relative min-h-0 flex-1 overflow-hidden bg-surface-2",
              chatSidebar && chatOpen && "hidden lg:block"
            )}>
              {!remoteVideoTrack && (
                <div className="flex h-full flex-col items-center justify-center gap-xs text-body">
                  <IconVideoOff size={24} stroke={1.75} aria-hidden="true" />
                  <span className="max-w-full truncate px-md text-ui-sm">{call.counterpartName ?? "Your call partner"}&apos;s camera is off</span>
                </div>
              )}
              <video ref={remoteVideo} aria-label={`${call.counterpartName ?? "Your call partner"} video`} autoPlay muted playsInline className={cn("absolute inset-0 h-full w-full object-contain", remoteVideoTrack ? "block" : "hidden")} />
              {remoteSpeaking && !remoteMuted && (
                <div
                  role={mobile ? undefined : "status"}
                  aria-label={`${call.counterpartName ?? "Your call partner"} is speaking`}
                  aria-hidden={mobile ? true : undefined}
                  className="absolute bottom-sm left-sm z-10 flex min-h-control items-center rounded-pill bg-bg px-sm"
                >
                  <MicrophoneVolumeMeter
                    level={remoteMicrophoneLevel}
                    active
                  />
                </div>
              )}
              {remoteMuted && (
                <div role="status" aria-live="polite" aria-atomic="true" className="absolute inset-x-sm bottom-sm z-10 mx-auto flex w-fit items-center gap-xs rounded-pill bg-bg px-sm py-xs text-ui-xs text-foreground">
                  <IconMicrophoneOff size={16} stroke={1.75} aria-hidden="true" />
                  <span className="max-w-full truncate">{call.counterpartName ?? "Your call partner"} is muted</span>
                </div>
              )}
              <DraggableVideoPreview
                stageRef={videoStageRef}
                stream={localVideoStream}
              />
            </div>

            {chatSidebar && (
              <aside
                id="call-messages"
                aria-label={`Messages with ${call.counterpartName ?? "your call partner"}`}
                className={cn(
                  "min-h-0 w-full flex-col border-l border-divider bg-surface lg:w-chat-preview lg:shrink-0",
                  chatOpen ? "flex" : "hidden"
                )}
              >
                <header className="flex h-chat-header shrink-0 flex-col justify-center border-b border-divider px-md">
                  <h2 className="font-sans text-ui-md font-semibold text-foreground">Messages</h2>
                  <p className="text-ui-xs text-muted">{call.counterpartName ?? "Your call partner"}</p>
                </header>
                <div className="flex min-h-0 flex-1">{chatSidebar}</div>
              </aside>
            )}
          </div>
        )}

        <div className={cn(
          "flex flex-col",
          callPrompt ? "gap-lg p-page" : "gap-md p-md",
          screen && "mobile-controls-safe"
        )}>
          <div className={cn("min-w-0", !callPrompt && "flex items-center gap-sm", videoStage && "sr-only")}>
            {!callPrompt && <span className="flex size-control shrink-0 items-center justify-center rounded-pill bg-surface-2 text-foreground">
              {call.kind === "video" ? <IconVideo size={20} stroke={1.75} aria-hidden="true" /> : <IconPhone size={20} stroke={1.75} aria-hidden="true" />}
            </span>}
            <div className={cn("min-w-0 flex-1", callPrompt && "flex flex-col gap-2xs")} role="status" aria-live={incoming ? "assertive" : "polite"} aria-atomic="true">
              <h2 id="call-popover-heading" className={cn(
                "font-semibold text-foreground",
                callPrompt ? "break-words font-serif text-heading-sm" : "truncate font-sans text-ui-md"
              )}>{copy.heading}</h2>
              <p className={cn("text-body", callPrompt ? "text-ui-sm" : "truncate text-ui-xs")}>{copy.status}</p>
            </div>
          </div>

          {call.kind === "audio" && ["active", "reconnecting"].includes(call.status) && (
            <div role="group" aria-label="Call activity" className="grid grid-cols-2 divide-x divide-divider overflow-hidden rounded-control bg-surface-2 text-left">
              <div className="flex min-w-0 items-center gap-xs px-sm py-xs">
                {call.muted
                  ? <IconMicrophoneOff size={16} stroke={1.75} className="shrink-0 text-muted" aria-hidden="true" />
                  : <IconMicrophone size={16} stroke={1.75} className={cn("shrink-0", localMicrophoneActive ? "text-success" : "text-muted")} aria-hidden="true" />}
                <div className="min-w-0">
                  <span className="block truncate text-ui-2xs font-medium text-muted">You</span>
                  <span className="block truncate text-ui-xs text-foreground">{call.muted ? "Muted" : localMicrophoneActive ? "Voice detected" : "Listening"}</span>
                </div>
              </div>
              <div role="group" aria-label={`${call.counterpartName ?? "Call partner"} microphone`} className="flex min-w-0 items-center gap-xs px-sm py-xs">
                {remoteMuted
                  ? <IconMicrophoneOff size={16} stroke={1.75} className="shrink-0 text-muted" aria-hidden="true" />
                  : <MicrophoneVolumeMeter level={remoteMicrophoneLevel} active={remoteSpeaking} className="shrink-0" />}
                <div className="min-w-0">
                  <span className="block truncate text-ui-2xs font-medium text-muted">{call.counterpartName ?? "Call partner"}</span>
                  <span
                    role={mobile ? undefined : "status"}
                    aria-live={mobile ? undefined : "polite"}
                    aria-atomic={mobile ? undefined : "true"}
                    className="block truncate text-ui-xs text-foreground"
                  >{remoteMuted ? "Muted" : remoteSpeaking ? "Speaking" : "Listening"}</span>
                </div>
              </div>
            </div>
          )}

          {notice && <Alert tone="notice" className="text-left">{notice}</Alert>}
          {audioBlocked && call.status === "active" && (
            <div className="flex flex-col gap-xs">
              <Alert tone="notice" className="text-left">Your browser is waiting for permission to play the call.</Alert>
              <Button variant="secondary" fullWidth onClick={() => void hearCall()}>Hear call</Button>
            </div>
          )}
          {incoming && (
            <div className="grid grid-cols-2 gap-sm">
              <Button
                variant="secondary"
                fullWidth
                loading={pendingIncomingAction === "decline"}
                disabled={busy || pendingIncomingAction !== null}
                onClick={() => void runIncomingAction("decline", decline)}
                className="min-h-control-primary border-error text-error hover:bg-surface-3 active:bg-surface-3"
              >
                <span className="inline-flex items-center gap-xs">
                  <IconPhoneOff size={20} stroke={1.75} aria-hidden="true" />
                  <span>Decline</span>
                </span>
              </Button>
              <Button
                fullWidth
                loading={pendingIncomingAction === "answer"}
                disabled={busy || pendingIncomingAction !== null}
                onClick={() => void runIncomingAction("answer", answer)}
                className="bg-success text-on-primary hover:bg-success-press active:bg-success-press"
              >
                <span className="inline-flex items-center gap-xs">
                  {call.kind === "video"
                    ? <IconVideo size={20} stroke={1.75} aria-hidden="true" />
                    : <IconPhone size={20} stroke={1.75} aria-hidden="true" />}
                  <span>Answer</span>
                </span>
              </Button>
            </div>
          )}
          {outgoingRinging && (
            <div className="flex justify-start">
              <Button
                variant="secondary"
                loading={pendingOutgoingCancel}
                disabled={busy}
                onClick={() => void runOutgoingCancel()}
                className="min-h-control-primary border-error text-error hover:bg-surface-3 active:bg-surface-3"
              >
                <span className="inline-flex items-center gap-xs">
                  <IconPhoneOff size={20} stroke={1.75} aria-hidden="true" />
                  <span>Cancel</span>
                </span>
              </Button>
            </div>
          )}

          {inProgress && (
            <Tooltip.Provider delay={400} closeDelay={0}>
              <div className="flex items-center justify-center gap-xs">
                {call.status !== "connecting" && (
                  <>
                    <span className="inline-flex items-center gap-2xs">
                      {call.kind === "video" && <MicrophoneVolumeMeter level={call.muted ? 0 : localMicrophoneLevel} active={!call.muted && localMicrophoneActive} />}
                      <IconButton label={call.muted ? "Unmute" : "Mute"} tooltip onClick={() => void toggleMute()} icon={call.muted ? <IconMicrophoneOff data-testid="microphone-off-icon" size={20} stroke={1.75} aria-hidden="true" /> : <IconMicrophone data-testid="microphone-on-icon" size={20} stroke={1.75} aria-hidden="true" />} />
                    </span>
                    {call.kind === "video" && <IconButton label={call.cameraEnabled ? "Turn camera off" : "Turn camera on"} tooltip onClick={() => void toggleCamera()} icon={call.cameraEnabled ? <IconVideo data-testid="camera-on-icon" size={20} stroke={1.75} aria-hidden="true" /> : <IconVideoOff data-testid="camera-off-icon" size={20} stroke={1.75} aria-hidden="true" />} />}
                    {(!screen || chatSidebar) && (
                      <IconButton
                        label={screen && chatOpen ? "Close chat" : "Open chat"}
                        tooltip
                        loading={openingChat}
                        aria-controls={screen ? "call-messages" : undefined}
                        aria-expanded={screen ? chatOpen : undefined}
                        aria-pressed={screen ? chatOpen : undefined}
                        className={cn(screen && chatOpen && "bg-surface-3")}
                        onClick={() => void openChat()}
                        icon={<IconMessages size={20} stroke={1.75} aria-hidden="true" />}
                      />
                    )}
                    <Popover.Root open={settingsOpen} onOpenChange={(open) => { setSettingsOpen(open); if (open) void refreshMicrophones(); }}>
                      <Popover.Trigger render={<IconButton label="Call settings" tooltip icon={<IconSettings size={20} stroke={1.75} aria-hidden="true" />} />} />
                      <Popover.Portal>
                        <Popover.Positioner side="top" align="end" sideOffset={4} className="z-50">
                          <Popover.Popup aria-label="Call settings" initialFocus={false} className="call-settings-popover rounded-control border border-divider bg-surface p-md outline-none">
                            <div className="flex flex-col gap-md">
                              {microphoneOptions.length > 0 ? (
                                <MediaDeviceSelect label="Microphone" value={microphoneId} options={microphoneOptions.map((option) => ({ id: option.deviceId, label: option.label }))} onValueChange={(value) => { setMicrophoneId(value); void switchMicrophone(value); }} />
                              ) : <p role="status" className="text-ui-sm text-body">Finding microphones…</p>}
                              {call.kind === "video" && (
                                <label className="flex min-h-control cursor-pointer items-center justify-between gap-sm text-left">
                                  <span className="flex min-w-0 flex-col gap-2xs"><span className="text-ui-sm text-foreground">Use less data</span><span id="video-quality-description" className="text-ui-xs text-body">Lowers video quality to help on slower connections.</span></span>
                                  <Switch aria-label="Use less data" aria-describedby="video-quality-description" className="shrink-0" checked={videoQualityPreference === "data-saver"} onCheckedChange={(checked) => setVideoQualityPreference(checked ? "data-saver" : "auto")} />
                                </label>
                              )}
                            </div>
                          </Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    </Popover.Root>
                  </>
                )}
                <IconButton label="End call" tooltip tone="critical" loading={busy} onClick={() => void end()} icon={<IconPhoneOff size={20} stroke={1.75} aria-hidden="true" />} />
              </div>
            </Tooltip.Provider>
          )}
        </div>
      </Card>
    </Root>
  );
}
