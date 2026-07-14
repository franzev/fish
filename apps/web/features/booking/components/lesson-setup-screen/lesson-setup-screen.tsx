"use client";

import { useCall } from "@/features/calls";
import type { TimeFormatPref } from "@/lib/prefs/time-format";
import type { CallCommandService, LessonSlot } from "@/lib/services";
import { getCallCommandService } from "@/lib/services/runtime/browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LessonMediaError,
  LessonSetupMediaSession,
  supportsSpeakerSelection,
  type LessonMediaDevice,
  type LessonMediaSnapshot,
} from "../../client/lesson-setup-media";
import type { BookingCoach } from "../../contracts";
import { isLessonJoinable } from "../../format";
import {
  LessonSetupView,
  type LessonConnectionStatus,
  type LessonMediaStatus,
} from "../lesson-setup-view";

export interface LessonSetupScreenProps {
  coach: BookingCoach | null;
  lesson: LessonSlot | null;
  locale: string;
  timeZone: string;
  timeFormatPref: TimeFormatPref;
  joinWindowMinutes: number;
  initialNow: string;
  commands?: CallCommandService;
}

/** Owns browser media and call orchestration while LessonSetupView owns the UI. */
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
  const commands = useMemo(() => getCallCommandService(commandsOverride), [commandsOverride]);
  const sessionRef = useRef<LessonSetupMediaSession | null>(null);
  const clockOffset = useRef(0);
  const [now, setNow] = useState(() => new Date(initialNow));
  const [mediaStatus, setMediaStatus] = useState<LessonMediaStatus>("starting");
  const [connectionStatus, setConnectionStatus] = useState<LessonConnectionStatus>("waiting");
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
  const joinable = lesson ? isLessonJoinable(lesson, joinWindowMinutes, now) : false;

  useEffect(() => {
    clockOffset.current = new Date(initialNow).getTime() - Date.now();
    const timer = window.setInterval(() => setNow(new Date(Date.now() + clockOffset.current)), 1_000);
    return () => window.clearInterval(timer);
  }, [initialNow]);

  const applySnapshot = useCallback((snapshot: LessonMediaSnapshot) => {
    setStream(snapshot.stream);
    setDevices(snapshot.devices);
    setMicrophoneId(snapshot.microphoneId);
    setCameraId(snapshot.cameraId);
    setMicrophoneEnabled(snapshot.stream.getAudioTracks().some((track) => track.enabled));
    setCameraEnabled(snapshot.stream.getVideoTracks().some((track) => track.enabled));
    const defaultSpeaker = snapshot.devices.find((device) => device.kind === "audiooutput" && device.deviceId === "default")
      ?? snapshot.devices.find((device) => device.kind === "audiooutput");
    setSpeakerId((current) => current || defaultSpeaker?.deviceId || "");
  }, []);

  const runConnectionCheck = useCallback(async (session: LessonSetupMediaSession, activeLesson: LessonSlot) => {
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
      setNotice("Your camera and microphone are ready, but we couldn’t check the call connection. Check your internet and try again.");
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
      const status = error instanceof LessonMediaError ? error.reason : "denied";
      setMediaStatus(status);
      setConnectionStatus("unavailable");
      setNotice(status === "denied"
        ? "Camera and microphone access is off. Allow access in your browser settings, then reload this page."
        : "We couldn’t find a camera or microphone. Connect a device, then reload this page.");
    });
    const refreshDevices = () => void session.refreshDevices().then((nextDevices) => {
      if (active) setDevices(nextDevices);
    }).catch(() => undefined);
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
    if (!lesson || ended || mediaStatus !== "starting") return;
    const timer = window.setTimeout(() => {
      setNotice((current) => current ?? "Your browser is waiting for camera and microphone permission.");
    }, 4_000);
    return () => window.clearTimeout(timer);
  }, [ended, lesson, mediaStatus]);

  const switchInput = useCallback(async (kind: "audioinput" | "videoinput", deviceId: string) => {
    const session = sessionRef.current;
    if (!session) return;
    setNotice(null);
    try {
      const snapshot = await session.switchInput(kind, deviceId);
      applySnapshot(snapshot);
      if (lesson) await runConnectionCheck(session, lesson);
    } catch {
      setNotice(kind === "audioinput"
        ? "That microphone isn’t available. Your previous microphone still works."
        : "That camera isn’t available. Your previous camera still works.");
    }
  }, [applySnapshot, lesson, runConnectionCheck]);

  function toggleMicrophone() {
    const next = !microphoneEnabled;
    if (sessionRef.current?.setEnabled("audio", next)) setMicrophoneEnabled(next);
  }

  function toggleCamera() {
    const next = !cameraEnabled;
    if (sessionRef.current?.setEnabled("video", next)) setCameraEnabled(next);
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

  return (
    <LessonSetupView
      coach={coach}
      lesson={lesson}
      locale={locale}
      timeZone={timeZone}
      timeFormatPref={timeFormatPref}
      ended={ended}
      joinable={joinable}
      mediaStatus={mediaStatus}
      connectionStatus={connectionStatus}
      stream={stream}
      microphoneAvailable={Boolean(stream?.getAudioTracks().length)}
      cameraAvailable={Boolean(stream?.getVideoTracks().length)}
      devices={devices}
      microphoneId={microphoneId}
      cameraId={cameraId}
      speakerId={speakerId}
      microphoneEnabled={microphoneEnabled}
      cameraEnabled={cameraEnabled}
      microphoneLevel={microphoneLevel}
      notice={notice}
      callNotice={callNotice}
      speakerNotice={speakerNotice}
      busy={busy}
      speakerSelectionSupported={supportsSpeakerSelection()}
      onToggleMicrophone={toggleMicrophone}
      onToggleCamera={toggleCamera}
      onSwitchInput={(kind, value) => void switchInput(kind, value)}
      onSpeakerChange={setSpeakerId}
      onPlayTestSound={() => void playTestSound()}
      onRetryConnection={() => {
        if (sessionRef.current && lesson) void runConnectionCheck(sessionRef.current, lesson);
      }}
      onJoin={() => {
        if (lesson && coach) void startLessonCall(lesson.id, coach.id, coach.displayName);
      }}
    />
  );
}
