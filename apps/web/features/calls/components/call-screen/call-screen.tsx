"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconPhone,
  IconVideo,
  IconVideoOff,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCall } from "../call-provider";

export function CallScreen({ callId }: { callId: string }) {
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
    remoteVideoStream,
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

  useEffect(() => {
    if (loadedId.current === callId) return;
    loadedId.current = callId;
    void loadCall(callId);
  }, [callId, loadCall]);

  useEffect(() => () => leaveSurface(), [leaveSurface]);

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = localVideoStream;
  }, [localVideoStream]);

  useEffect(() => {
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteVideoStream;
  }, [remoteVideoStream]);

  async function toggleAudioSettings() {
    const nextOpen = !audioSettingsOpen;
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

  function leave() {
    clear();
    router.push(homeHref);
  }

  return (
    <div className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center gap-lg py-xl">
      <Card className="flex flex-col items-center gap-lg py-2xl text-center">
        <span className="flex min-h-control min-w-control items-center justify-center rounded-pill bg-surface-2 text-foreground">
          <IconPhone size={28} stroke={1.75} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-xs">
          <h1 className="text-heading-sm">{heading}</h1>
          <p className="text-body">
            {call.status === "ringing" && call.direction === "outgoing"
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
              : "Preparing your call."}
          </p>
        </div>

        {call.kind === "video" &&
          ["connecting", "active", "reconnecting"].includes(call.status) && (
          <div className="relative aspect-video w-full overflow-hidden rounded-card bg-surface-2">
            {!remoteVideoStream && (
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
              className={`h-full w-full object-cover ${
                remoteVideoStream ? "block" : "hidden"
              }`}
            />
            <div className="absolute bottom-sm right-sm aspect-video w-1/3 overflow-hidden rounded-control bg-bg">
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
        )}

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
          {["connecting", "active", "reconnecting"].includes(call.status) && (
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
                  {call.kind === "video" && (
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => void toggleCamera()}
                    >
                      <span className="inline-flex items-center gap-xs">
                        {call.cameraEnabled ? (
                          <IconVideoOff size={20} aria-hidden="true" />
                        ) : (
                          <IconVideo size={20} aria-hidden="true" />
                        )}
                        {call.cameraEnabled ? "Turn camera off" : "Turn camera on"}
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    fullWidth
                    aria-expanded={audioSettingsOpen}
                    onClick={() => void toggleAudioSettings()}
                  >
                    Audio settings
                  </Button>
                  {audioSettingsOpen && microphoneOptions.length > 0 && (
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
                  )}
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
