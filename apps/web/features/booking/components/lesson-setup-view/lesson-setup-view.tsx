"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MediaDeviceSelect } from "@/components/ui/media-device-select";
import { MicrophoneVolumeMeter } from "@/components/ui/microphone-volume-meter";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import type { LessonSlot } from "@/lib/services";
import { cn } from "@/lib/utils";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  IconCamera,
  IconCameraOff,
  IconCheck,
  IconMicrophone,
  IconMicrophoneOff,
  IconPlugConnected,
  IconSettings,
  IconVolume,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import type { LessonMediaDevice } from "../../client/lesson-setup-media";
import type { BookingCoach } from "../../contracts";
import { formatLessonDate, formatLessonTime, formatTimeZoneLabel } from "../../format";

export type LessonMediaStatus = "starting" | "ready" | "denied" | "unavailable";
export type LessonConnectionStatus = "waiting" | "checking" | "ready" | "unavailable";

export interface LessonSetupViewProps {
  coach: BookingCoach | null;
  lesson: LessonSlot | null;
  locale: string;
  timeZone: string;
  timeFormatPref: TimeFormatPref;
  ended: boolean;
  joinable: boolean;
  mediaStatus: LessonMediaStatus;
  connectionStatus: LessonConnectionStatus;
  stream: MediaStream | null;
  microphoneAvailable: boolean;
  cameraAvailable: boolean;
  devices: LessonMediaDevice[];
  microphoneId: string;
  cameraId: string;
  speakerId: string;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  microphoneLevel: number;
  notice: string | null;
  callNotice: string | null;
  speakerNotice: string | null;
  busy: boolean;
  speakerSelectionSupported: boolean;
  onToggleMicrophone(): void;
  onToggleCamera(): void;
  onSwitchInput(kind: "audioinput" | "videoinput", deviceId: string): void;
  onSpeakerChange(deviceId: string): void;
  onPlayTestSound(): void;
  onRetryConnection(): void;
  onJoin(): void;
}

function devicesByKind(devices: LessonMediaDevice[], kind: MediaDeviceKind) {
  return devices.filter((device) => device.kind === kind);
}

export function LessonSetupView(props: LessonSetupViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const {
    coach, lesson, locale, timeZone, timeFormatPref, ended, joinable,
    mediaStatus, connectionStatus, stream, microphoneAvailable, cameraAvailable,
    devices, microphoneId, cameraId,
    speakerId, microphoneEnabled, cameraEnabled, microphoneLevel, notice,
    callNotice, speakerNotice, busy, speakerSelectionSupported,
    onToggleMicrophone, onToggleCamera, onSwitchInput, onSpeakerChange,
    onPlayTestSound, onRetryConnection, onJoin,
  } = props;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  if (!coach || !lesson) {
    return (
      <div className="flex min-h-full w-full flex-col bg-bg">
        <header className="flex shrink-0 items-center border-b border-divider bg-surface px-page py-md"><h1 className="flex-1 text-heading-sm">Lesson setup</h1></header>
        <main className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center px-page py-xl text-center">
          <h2 className="text-display">This lesson isn’t available</h2>
          <p className="mt-xs text-body">Return home to see your upcoming lesson.</p>
          <Button href="/home" fullWidth className="mt-lg">Back to home</Button>
        </main>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="flex min-h-full w-full flex-col bg-bg">
        <header className="flex shrink-0 items-center border-b border-divider bg-surface px-page py-md"><h1 className="flex-1 text-heading-sm">Lesson setup</h1></header>
        <main className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center px-page py-xl text-center">
          <h2 className="text-display">This lesson has ended</h2>
          <p className="mt-xs text-body">Return home to see what’s next.</p>
          <Button href="/home" fullWidth className="mt-lg">Back to home</Button>
        </main>
      </div>
    );
  }

  const microphoneDevices = devicesByKind(devices, "audioinput");
  const cameraDevices = devicesByKind(devices, "videoinput");
  const speakerDevices = devicesByKind(devices, "audiooutput");
  const microphoneActive = microphoneEnabled && microphoneLevel >= 0.15;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-md border-b border-divider bg-surface px-page py-md">
        <h1 className="flex-1 text-heading-sm">Lesson setup</h1>
        <Button href="/home" aria-label="Close lesson setup" variant="ghost" controlSize="square"><IconX size={20} stroke={1.75} aria-hidden="true" /></Button>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-marketing flex-1 gap-lg overflow-y-auto px-page py-lg lg:grid-cols-2 lg:items-center lg:py-xl">
        <section aria-label="Camera preview" className="flex min-w-0 flex-col gap-sm">
          <div className="relative aspect-video overflow-hidden rounded-card bg-surface-2">
            {!cameraEnabled && <div className="absolute inset-0 flex flex-col items-center justify-center gap-xs text-body"><IconCameraOff size={28} aria-hidden="true" /><span className="text-ui-sm">Camera is off</span></div>}
            <video ref={videoRef} aria-label="Your camera preview" autoPlay muted playsInline className={cn("h-full w-full -scale-x-100 object-cover", cameraEnabled ? "block" : "hidden")} />
            <Tooltip.Provider delay={400} closeDelay={0}>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-xs p-sm">
                <TooltipIconButton type="button" label={microphoneEnabled ? "Mute" : "Unmute"} aria-pressed={!microphoneEnabled} disabled={mediaStatus !== "ready" || !microphoneAvailable} onClick={onToggleMicrophone} tooltipClassName="z-30" icon={microphoneEnabled ? <IconMicrophone data-testid="lesson-microphone-on-icon" size={20} stroke={1.75} aria-hidden="true" /> : <IconMicrophoneOff data-testid="lesson-microphone-off-icon" size={20} stroke={1.75} aria-hidden="true" />} />
                <TooltipIconButton type="button" label={cameraEnabled ? "Turn camera off" : "Turn camera on"} aria-pressed={!cameraEnabled} disabled={mediaStatus !== "ready" || !cameraAvailable} onClick={onToggleCamera} tooltipClassName="z-30" icon={cameraEnabled ? <IconCamera data-testid="lesson-camera-on-icon" size={20} stroke={1.75} aria-hidden="true" /> : <IconCameraOff data-testid="lesson-camera-off-icon" size={20} stroke={1.75} aria-hidden="true" />} />
              </div>
            </Tooltip.Provider>
          </div>

          <details className="rounded-control bg-surface">
            <summary className="flex min-h-control cursor-pointer list-none items-center gap-xs rounded-control px-md text-ui text-body hover:bg-surface-2"><IconSettings size={20} aria-hidden="true" />Device settings</summary>
            <div className="flex flex-col gap-md border-t border-divider p-md">
              {microphoneDevices.length >= 2 && <MediaDeviceSelect label="Microphone" value={microphoneId} options={microphoneDevices.map((device) => ({ id: device.deviceId, label: device.label }))} onValueChange={(value) => onSwitchInput("audioinput", value)} />}
              {cameraDevices.length >= 2 && <MediaDeviceSelect label="Camera" value={cameraId} options={cameraDevices.map((device) => ({ id: device.deviceId, label: device.label }))} onValueChange={(value) => onSwitchInput("videoinput", value)} />}
              {speakerSelectionSupported && speakerDevices.length >= 2 && <MediaDeviceSelect label="Speaker" value={speakerId} options={speakerDevices.map((device) => ({ id: device.deviceId, label: device.label }))} onValueChange={onSpeakerChange} />}
              <Button type="button" variant="secondary" onClick={onPlayTestSound}><span className="inline-flex items-center gap-xs"><IconVolume size={20} aria-hidden="true" />Play test sound</span></Button>
              {speakerNotice && <p role="status" className="text-ui-sm text-body">{speakerNotice}</p>}
            </div>
          </details>
        </section>

        <section className="flex flex-col">
          <p className="text-ui-sm text-muted">Lesson with {coach.displayName}</p>
          <h2 className="mt-xs text-display">{formatLessonDate(lesson.startsAt, { locale, timeZone })}</h2>
          <p className="mt-xs text-body">{formatLessonTime(lesson.startsAt, timeFormatPref, { locale, timeZone })} · {formatTimeZoneLabel(timeZone, lesson.startsAt)}</p>
          <p className="mt-md text-body">{joinable ? "Your lesson is ready when you are." : "This check is private and won’t notify your coach."}</p>

          <div className="mt-lg divide-y divide-divider" aria-live="polite">
            <div className="flex items-center gap-sm py-sm">
              {cameraEnabled ? <IconCheck size={20} aria-hidden="true" /> : <IconCameraOff size={20} aria-hidden="true" />}
              <span className="text-ui text-body">{mediaStatus === "starting" ? "Starting your camera…" : cameraEnabled ? "Camera is working" : "Camera is unavailable or off"}</span>
            </div>
            <div className="flex items-center gap-sm py-sm">
              {microphoneEnabled ? <IconMicrophone size={20} aria-hidden="true" className={microphoneActive ? "text-success" : undefined} /> : <IconMicrophoneOff size={20} aria-hidden="true" />}
              <span className="flex-1 text-ui text-body">{microphoneEnabled ? microphoneActive ? "We can hear you" : "Speak to check your microphone" : "Microphone is unavailable or muted"}</span>
              <MicrophoneVolumeMeter level={microphoneLevel} active={microphoneActive} />
            </div>
            <div className="flex items-center gap-sm py-sm">
              <IconPlugConnected size={20} aria-hidden="true" />
              <span className="flex-1 text-ui text-body">{connectionStatus === "waiting" ? "Connection check starts after device access" : connectionStatus === "checking" ? "Checking your connection…" : connectionStatus === "ready" ? "Connection is ready" : "Connection check needs another try"}</span>
              {connectionStatus === "unavailable" && mediaStatus === "ready" && <Button type="button" variant="ghost" onClick={onRetryConnection}>Check again</Button>}
            </div>
          </div>

          {(notice || callNotice) && <Alert tone="notice" className="mt-md">{callNotice ?? notice}</Alert>}
          <div className="mt-lg">
            {joinable ? <Button type="button" fullWidth loading={busy} onClick={onJoin}>Join lesson</Button> : <Button href="/home" fullWidth>Done</Button>}
          </div>
        </section>
      </main>
    </div>
  );
}
