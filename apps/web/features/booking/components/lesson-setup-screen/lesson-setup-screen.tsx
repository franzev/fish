"use client";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { MicrophoneVolumeMeter } from "@/components/ui/microphone-volume-meter";
import { useCall } from "@/features/calls";
import type { CallCommandService, LessonSlot } from "@/lib/services";
import { getCallCommandService } from "@/lib/services/runtime/browser";
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
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import type { BookingCoach } from "../../contracts";
import {
  formatLessonDate,
  formatLessonTime,
  formatTimeZoneLabel,
  isLessonJoinable,
} from "../../format";
import {
  LessonMediaError,
  LessonSetupMediaSession,
  supportsSpeakerSelection,
  type LessonMediaDevice,
  type LessonMediaSnapshot,
} from "../../client/lesson-setup-media";

interface LessonSetupScreenProps {
  coach: BookingCoach | null;
  lesson: LessonSlot | null;
  locale: string;
  timeZone: string;
  timeFormatPref: TimeFormatPref;
  joinWindowMinutes: number;
  initialNow: string;
  commands?: CallCommandService;
}

type MediaStatus = "starting" | "ready" | "denied" | "unavailable";
type ConnectionStatus = "waiting" | "checking" | "ready" | "unavailable";

function devicesByKind(devices: LessonMediaDevice[], kind: MediaDeviceKind) {
  return devices.filter((device) => device.kind === kind);
}

export function LessonSetupScreen({
  coach,
  lesson,
  locale,
  timeZone,
  timeFormatPref,
  joinWindowMinutes,
  initialNow,
  commands: commandsOverride,
}: LessonSetupScreenProps) {
  const { startLessonCall, busy, notice: callNotice } = useCall();
  const commands = useMemo(
    () => getCallCommandService(commandsOverride),
    [commandsOverride]
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<LessonSetupMediaSession | null>(null);
  const clockOffset = useRef(0);
  const [now, setNow] = useState(() => new Date(initialNow));
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>("starting");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("waiting");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<LessonMediaDevice[]>([]);
  const [microphoneId, setMicrophoneId] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [speakerNotice, setSpeakerNotice] = useState<string | null>(null);

  const ended = !lesson || now.getTime() >= new Date(lesson.endsAt).getTime();
  const joinable = lesson
    ? isLessonJoinable(lesson, joinWindowMinutes, now)
    : false;

  useEffect(() => {
    clockOffset.current = new Date(initialNow).getTime() - Date.now();
    const timer = window.setInterval(() => {
      setNow(new Date(Date.now() + clockOffset.current));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [initialNow]);

  const applySnapshot = useCallback((snapshot: LessonMediaSnapshot) => {
    setStream(snapshot.stream);
    setDevices(snapshot.devices);
    setMicrophoneId(snapshot.microphoneId);
    setCameraId(snapshot.cameraId);
    setMicrophoneEnabled(snapshot.stream.getAudioTracks().some((track) => track.enabled));
    setCameraEnabled(snapshot.stream.getVideoTracks().some((track) => track.enabled));
    const defaultSpeaker = snapshot.devices.find(
      (device) => device.kind === "audiooutput" && device.deviceId === "default"
    ) ?? snapshot.devices.find((device) => device.kind === "audiooutput");
    setSpeakerId((current) => current || defaultSpeaker?.deviceId || "");
  }, []);

  const runConnectionCheck = useCallback(async (
    session: LessonSetupMediaSession,
    activeLesson: LessonSlot
  ) => {
    setConnectionStatus("checking");
    setNotice(null);
    const result = await commands.checkMedia(activeLesson.id);
    if (!result.ok) {
      setConnectionStatus("unavailable");
      setNotice(result.notice);
      return;
    }
    try {
      await session.checkConnection(result.connection);
      setConnectionStatus("ready");
    } catch {
      setConnectionStatus("unavailable");
      setNotice(
        "Your camera and microphone are ready, but we couldn’t check the call connection. Check your internet and try again."
      );
    }
  }, [commands]);

  useEffect(() => {
    if (!lesson || ended) return;
    let active = true;
    const session = new LessonSetupMediaSession({
      onMicrophoneLevel(value) {
        if (active) setMicrophoneLevel(value);
      },
      onTrackEnded(kind) {
        if (!active) return;
        if (kind === "audio") {
          setMicrophoneEnabled(false);
          setNotice("Your microphone disconnected. Choose another microphone in device settings.");
        } else {
          setCameraEnabled(false);
          setNotice("Your camera disconnected. You can choose another camera or continue with audio.");
        }
      },
    });
    sessionRef.current = session;

    void session.start().then(async (snapshot) => {
      if (!active) {
        session.stop();
        return;
      }
      applySnapshot(snapshot);
      setMediaStatus("ready");
      await runConnectionCheck(session, lesson);
    }).catch((error) => {
      if (!active) return;
      const status = error instanceof LessonMediaError
        ? error.reason
        : "denied";
      setMediaStatus(status);
      setConnectionStatus("unavailable");
      setNotice(
        status === "denied"
          ? "Camera and microphone access is off. Allow access in your browser settings, then reload this page."
          : "We couldn’t find a camera or microphone. Connect a device, then reload this page."
      );
    });

    const refreshDevices = () => {
      void session.refreshDevices().then((nextDevices) => {
        if (active) setDevices(nextDevices);
      }).catch(() => undefined);
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    const release = () => session.stop();
    window.addEventListener("pagehide", release);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
      window.removeEventListener("pagehide", release);
      session.stop();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [applySnapshot, ended, lesson, runConnectionCheck]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (!lesson || ended || mediaStatus !== "starting") return;
    const timer = window.setTimeout(() => {
      setNotice((current) => current ??
        "Your browser is waiting for camera and microphone permission.");
    }, 4_000);
    return () => window.clearTimeout(timer);
  }, [ended, lesson, mediaStatus]);

  const switchInput = useCallback(async (
    kind: "audioinput" | "videoinput",
    deviceId: string
  ) => {
    const session = sessionRef.current;
    if (!session) return;
    setNotice(null);
    try {
      const snapshot = await session.switchInput(kind, deviceId);
      applySnapshot(snapshot);
      if (lesson) await runConnectionCheck(session, lesson);
    } catch {
      setNotice(
        kind === "audioinput"
          ? "That microphone isn’t available. Your previous microphone still works."
          : "That camera isn’t available. Your previous camera still works."
      );
    }
  }, [applySnapshot, lesson, runConnectionCheck]);

  function toggleMicrophone() {
    const next = !microphoneEnabled;
    if (sessionRef.current?.setEnabled("audio", next)) {
      setMicrophoneEnabled(next);
    }
  }

  function toggleCamera() {
    const next = !cameraEnabled;
    if (sessionRef.current?.setEnabled("video", next)) {
      setCameraEnabled(next);
    }
  }

  async function playTestSound() {
    setSpeakerNotice(null);
    try {
      await sessionRef.current?.playTestSound(speakerId || undefined);
      setSpeakerNotice("Test sound played.");
    } catch {
      setSpeakerNotice("We couldn’t play the test sound. Check your volume and try again.");
    }
  }

  if (!coach || !lesson) {
    return (
      <div className="flex min-h-full w-full flex-col bg-bg">
        <header className="flex shrink-0 items-center border-b border-divider bg-surface px-page py-md">
          <h1 className="flex-1 text-heading-sm">Lesson setup</h1>
        </header>
        <main className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center px-page py-xl text-center">
          <h2 className="text-display">This lesson isn’t available</h2>
          <p className="mt-xs text-body">Return home to see your upcoming lesson.</p>
          <Link href="/home" className={cn(buttonVariants({ fullWidth: true }), "mt-lg")}>
            Back to home
          </Link>
        </main>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="flex min-h-full w-full flex-col bg-bg">
        <header className="flex shrink-0 items-center border-b border-divider bg-surface px-page py-md">
          <h1 className="flex-1 text-heading-sm">Lesson setup</h1>
        </header>
        <main className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center px-page py-xl text-center">
          <h2 className="text-display">This lesson has ended</h2>
          <p className="mt-xs text-body">Return home to see what’s next.</p>
          <Link href="/home" className={cn(buttonVariants({ fullWidth: true }), "mt-lg")}>
            Back to home
          </Link>
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
        <Link
          href="/home"
          aria-label="Close lesson setup"
          className="inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted hover:text-foreground"
        >
          <IconX size={24} stroke={1.75} aria-hidden="true" />
        </Link>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-marketing flex-1 gap-lg overflow-y-auto px-page py-lg lg:grid-cols-2 lg:items-center lg:py-xl">
        <section aria-label="Camera preview" className="flex min-w-0 flex-col gap-sm">
          <div className="relative aspect-video overflow-hidden rounded-card bg-surface-2">
            {!cameraEnabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-xs text-body">
                <IconCameraOff size={28} aria-hidden="true" />
                <span className="text-ui-sm">Camera is off</span>
              </div>
            )}
            <video
              ref={videoRef}
              aria-label="Your camera preview"
              autoPlay
              muted
              playsInline
              className={cn(
                "h-full w-full -scale-x-100 object-cover",
                cameraEnabled ? "block" : "hidden"
              )}
            />
            <Tooltip.Provider delay={400} closeDelay={0}>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-xs p-sm">
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label={microphoneEnabled ? "Mute" : "Unmute"}
                        aria-pressed={!microphoneEnabled}
                        disabled={mediaStatus !== "ready" || stream?.getAudioTracks().length === 0}
                        onClick={toggleMicrophone}
                        className="min-w-control px-0"
                      >
                        {microphoneEnabled ? (
                          <IconMicrophone
                            data-testid="lesson-microphone-on-icon"
                            size={20}
                            stroke={1.75}
                            aria-hidden="true"
                          />
                        ) : (
                          <IconMicrophoneOff
                            data-testid="lesson-microphone-off-icon"
                            size={20}
                            stroke={1.75}
                            aria-hidden="true"
                          />
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
                        {microphoneEnabled ? "Mute" : "Unmute"}
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                        aria-pressed={!cameraEnabled}
                        disabled={mediaStatus !== "ready" || stream?.getVideoTracks().length === 0}
                        onClick={toggleCamera}
                        className="min-w-control px-0"
                      >
                        {cameraEnabled ? (
                          <IconCamera
                            data-testid="lesson-camera-on-icon"
                            size={20}
                            stroke={1.75}
                            aria-hidden="true"
                          />
                        ) : (
                          <IconCameraOff
                            data-testid="lesson-camera-off-icon"
                            size={20}
                            stroke={1.75}
                            aria-hidden="true"
                          />
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
                        {cameraEnabled ? "Turn camera off" : "Turn camera on"}
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </div>
            </Tooltip.Provider>
          </div>

          <details className="rounded-control bg-surface">
            <summary className="flex min-h-control cursor-pointer list-none items-center gap-xs rounded-control px-md text-ui text-body hover:bg-surface-2">
              <IconSettings size={20} aria-hidden="true" />
              Device settings
            </summary>
            <div className="flex flex-col gap-md border-t border-divider p-md">
              {microphoneDevices.length >= 2 && (
                <label className="flex flex-col gap-xs text-ui-sm text-body">
                  Microphone
                  <select
                    className="min-h-control w-full rounded-control bg-surface-2 px-sm text-ui text-foreground"
                    value={microphoneId}
                    onChange={(event) => void switchInput("audioinput", event.target.value)}
                  >
                    {microphoneDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {cameraDevices.length >= 2 && (
                <label className="flex flex-col gap-xs text-ui-sm text-body">
                  Camera
                  <select
                    className="min-h-control w-full rounded-control bg-surface-2 px-sm text-ui text-foreground"
                    value={cameraId}
                    onChange={(event) => void switchInput("videoinput", event.target.value)}
                  >
                    {cameraDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {supportsSpeakerSelection() && speakerDevices.length >= 2 && (
                <label className="flex flex-col gap-xs text-ui-sm text-body">
                  Speaker
                  <select
                    className="min-h-control w-full rounded-control bg-surface-2 px-sm text-ui text-foreground"
                    value={speakerId}
                    onChange={(event) => setSpeakerId(event.target.value)}
                  >
                    {speakerDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Button type="button" variant="secondary" onClick={() => void playTestSound()}>
                <span className="inline-flex items-center gap-xs">
                  <IconVolume size={20} aria-hidden="true" />
                  Play test sound
                </span>
              </Button>
              {speakerNotice && <p role="status" className="text-ui-sm text-body">{speakerNotice}</p>}
            </div>
          </details>
        </section>

        <section className="flex flex-col">
          <p className="text-ui-sm text-muted">Lesson with {coach.displayName}</p>
          <h2 className="mt-xs text-display">
            {formatLessonDate(lesson.startsAt, { locale, timeZone })}
          </h2>
          <p className="mt-xs text-body">
            {formatLessonTime(lesson.startsAt, timeFormatPref, { locale, timeZone })} · {formatTimeZoneLabel(timeZone, lesson.startsAt)}
          </p>
          <p className="mt-md text-body">
            {joinable
              ? "Your lesson is ready when you are."
              : "This check is private and won’t notify your coach."}
          </p>

          <div className="mt-lg divide-y divide-divider" aria-live="polite">
            <div className="flex items-center gap-sm py-sm">
              {cameraEnabled ? <IconCheck size={20} aria-hidden="true" /> : <IconCameraOff size={20} aria-hidden="true" />}
              <span className="text-ui text-body">
                {mediaStatus === "starting"
                  ? "Starting your camera…"
                  : cameraEnabled
                  ? "Camera is working"
                  : "Camera is unavailable or off"}
              </span>
            </div>
            <div className="flex items-center gap-sm py-sm">
              {microphoneEnabled ? (
                <IconMicrophone
                  size={20}
                  aria-hidden="true"
                  className={microphoneActive ? "text-success" : undefined}
                />
              ) : (
                <IconMicrophoneOff size={20} aria-hidden="true" />
              )}
              <span className="flex-1 text-ui text-body">
                {microphoneEnabled
                  ? microphoneActive
                    ? "We can hear you"
                    : "Speak to check your microphone"
                  : "Microphone is unavailable or muted"}
              </span>
              <MicrophoneVolumeMeter
                level={microphoneLevel}
                active={microphoneActive}
              />
            </div>
            <div className="flex items-center gap-sm py-sm">
              <IconPlugConnected size={20} aria-hidden="true" />
              <span className="flex-1 text-ui text-body">
                {connectionStatus === "waiting"
                  ? "Connection check starts after device access"
                  : connectionStatus === "checking"
                  ? "Checking your connection…"
                  : connectionStatus === "ready"
                  ? "Connection is ready"
                  : "Connection check needs another try"}
              </span>
              {connectionStatus === "unavailable" && mediaStatus === "ready" && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const session = sessionRef.current;
                    if (session) void runConnectionCheck(session, lesson);
                  }}
                >
                  Check again
                </Button>
              )}
            </div>
          </div>

          {(notice || callNotice) && (
            <Alert tone="notice" className="mt-md">
              {callNotice ?? notice}
            </Alert>
          )}

          <div className="mt-lg">
            {joinable ? (
              <Button
                type="button"
                fullWidth
                loading={busy}
                onClick={() => void startLessonCall(lesson.id, coach.id, coach.displayName)}
              >
                Join lesson
              </Button>
            ) : (
              <Link href="/home" className={buttonVariants({ fullWidth: true })}>
                Done
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
