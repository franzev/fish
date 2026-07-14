"use client";

import type { CallConnection } from "@/lib/services";
import { Room, Track } from "livekit-client";

export type LessonMediaFailure = "denied" | "unavailable";

export class LessonMediaError extends Error {
  constructor(readonly reason: LessonMediaFailure) {
    super(reason);
    this.name = "LessonMediaError";
  }
}

export interface LessonMediaDevice {
  deviceId: string;
  kind: MediaDeviceKind;
  label: string;
}

export interface LessonMediaSnapshot {
  stream: MediaStream;
  devices: LessonMediaDevice[];
  microphoneId: string;
  cameraId: string;
}

interface LessonSetupMediaCallbacks {
  onMicrophoneLevel(level: number): void;
  onTrackEnded(kind: "audio" | "video"): void;
}

function mediaError(error: unknown): LessonMediaError {
  if (
    error instanceof DOMException &&
    ["NotFoundError", "OverconstrainedError"].includes(error.name)
  ) {
    return new LessonMediaError("unavailable");
  }
  return new LessonMediaError("denied");
}

function inputConstraint(deviceId?: string): MediaTrackConstraints {
  return deviceId ? { deviceId: { exact: deviceId } } : {};
}

export class LessonSetupMediaSession {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyserFrame: number | null = null;
  private microphoneLevel = 0;
  private smoothedMicrophoneLevel = 0;

  constructor(private readonly callbacks: LessonSetupMediaCallbacks) {}

  async start(): Promise<LessonMediaSnapshot> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new LessonMediaError("unavailable");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (error) {
      const firstFailure = mediaError(error);
      if (firstFailure.reason !== "unavailable") throw firstFailure;
      stream = await this.startWithAvailableDevice();
    }

    this.replaceStream(stream);
    return this.snapshot();
  }

  async switchInput(
    kind: "audioinput" | "videoinput",
    deviceId: string
  ): Promise<LessonMediaSnapshot> {
    if (!this.stream || !navigator.mediaDevices?.getUserMedia) {
      throw new LessonMediaError("unavailable");
    }
    const trackKind = kind === "audioinput" ? "audio" : "video";
    const currentTrack = this.stream.getTracks()
      .find((track) => track.kind === trackKind);
    const enabled = currentTrack?.enabled ?? true;
    let replacement: MediaStream;
    try {
      replacement = await navigator.mediaDevices.getUserMedia({
        audio: kind === "audioinput"
          ? {
            ...inputConstraint(deviceId),
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
          : false,
        video: kind === "videoinput"
          ? {
            ...inputConstraint(deviceId),
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
          : false,
      });
    } catch (error) {
      throw mediaError(error);
    }

    const nextTrack = replacement.getTracks()[0];
    if (!nextTrack) throw new LessonMediaError("unavailable");
    nextTrack.enabled = enabled;
    this.watchTrack(nextTrack);

    const retained = this.stream.getTracks()
      .filter((track) => track.kind !== trackKind);
    currentTrack?.stop();
    this.stream = new MediaStream([...retained, nextTrack]);
    if (trackKind === "audio") this.startMicrophoneMonitor();
    return this.snapshot();
  }

  setEnabled(kind: "audio" | "video", enabled: boolean): boolean {
    const track = this.stream?.getTracks().find((item) => item.kind === kind);
    if (!track) return false;
    track.enabled = enabled;
    if (kind === "audio" && !enabled) this.updateMicrophoneLevel(0);
    return true;
  }

  async refreshDevices(): Promise<LessonMediaDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    const counts = new Map<MediaDeviceKind, number>();
    return devices
      .filter((device) => ["audioinput", "audiooutput", "videoinput"].includes(device.kind))
      .map((device) => {
        const position = (counts.get(device.kind) ?? 0) + 1;
        counts.set(device.kind, position);
        const fallback = device.kind === "audioinput"
          ? `Microphone ${position}`
          : device.kind === "audiooutput"
          ? `Speaker ${position}`
          : `Camera ${position}`;
        return {
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label || fallback,
        };
      });
  }

  async checkConnection(connection: CallConnection): Promise<void> {
    const room = new Room({ adaptiveStream: false, dynacast: false });
    const clones = (this.stream?.getTracks() ?? [])
      .filter((track) => track.enabled)
      .map((track) => track.clone());
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        (async () => {
          await room.connect(connection.serverUrl, connection.participantToken, {
            autoSubscribe: false,
          });
          await Promise.all(
            clones.map((track) => room.localParticipant.publishTrack(track, {
              source: track.kind === "audio"
                ? Track.Source.Microphone
                : Track.Source.Camera,
            }))
          );
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Connection check timed out")),
            12_000
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
      await room.disconnect(true);
      clones.forEach((track) => track.stop());
    }
  }

  async playTestSound(outputDeviceId?: string): Promise<void> {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
    oscillator.frequency.setValueAtTime(440, context.currentTime);
    oscillator.connect(gain);

    let audio: HTMLAudioElement | null = null;
    let outputStream: MediaStream | null = null;
    const destination = context.createMediaStreamDestination();
    try {
      const canChooseOutput = outputDeviceId &&
        "setSinkId" in HTMLMediaElement.prototype;
      if (canChooseOutput) {
        gain.connect(destination);
        outputStream = destination.stream;
        audio = new Audio();
        audio.srcObject = outputStream;
        await audio.setSinkId(outputDeviceId);
        await audio.play();
      } else {
        gain.connect(context.destination);
      }

      await new Promise<void>((resolve) => {
        oscillator.addEventListener("ended", () => resolve(), { once: true });
        oscillator.start();
        oscillator.stop(context.currentTime + 0.5);
      });
    } finally {
      audio?.pause();
      outputStream?.getTracks().forEach((track) => track.stop());
      oscillator.disconnect();
      gain.disconnect();
      await context.close().catch(() => undefined);
    }
  }

  stop(): void {
    this.stopMicrophoneMonitor();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private async startWithAvailableDevice(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (audioError) {
      if (mediaError(audioError).reason !== "unavailable") {
        throw mediaError(audioError);
      }
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } catch (videoError) {
        throw mediaError(videoError);
      }
    }
  }

  private replaceStream(stream: MediaStream): void {
    this.stop();
    this.stream = stream;
    stream.getTracks().forEach((track) => this.watchTrack(track));
    this.startMicrophoneMonitor();
  }

  private watchTrack(track: MediaStreamTrack): void {
    track.addEventListener("ended", () => {
      this.callbacks.onTrackEnded(track.kind as "audio" | "video");
    }, { once: true });
  }

  private async snapshot(): Promise<LessonMediaSnapshot> {
    const devices = await this.refreshDevices();
    const microphoneId = this.stream?.getAudioTracks()[0]?.getSettings().deviceId ?? "";
    const cameraId = this.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? "";
    return {
      stream: this.stream ?? new MediaStream(),
      devices,
      microphoneId,
      cameraId,
    };
  }

  private startMicrophoneMonitor(): void {
    this.stopMicrophoneMonitor();
    const audioTrack = this.stream?.getAudioTracks()[0];
    if (!audioTrack) return;
    try {
      this.audioContext = new AudioContext();
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      this.audioContext.createMediaStreamSource(
        new MediaStream([audioTrack])
      ).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const readLevel = () => {
        analyser.getByteTimeDomainData(samples);
        let sumOfSquares = 0;
        for (const sample of samples) {
          const amplitude = (sample - 128) / 128;
          sumOfSquares += amplitude * amplitude;
        }

        const rms = Math.sqrt(sumOfSquares / samples.length);
        const decibels = 20 * Math.log10(Math.max(rms, 0.000_001));
        const measuredLevel = audioTrack.enabled
          ? Math.min(1, Math.max(0, (decibels + 50) / 40))
          : 0;
        const response = measuredLevel > this.smoothedMicrophoneLevel
          ? 0.35
          : 0.12;
        this.smoothedMicrophoneLevel +=
          (measuredLevel - this.smoothedMicrophoneLevel) * response;
        if (this.smoothedMicrophoneLevel < 0.01) {
          this.smoothedMicrophoneLevel = 0;
        }
        this.updateMicrophoneLevel(this.smoothedMicrophoneLevel);
        this.analyserFrame = window.requestAnimationFrame(readLevel);
      };
      this.analyserFrame = window.requestAnimationFrame(readLevel);
    } catch {
      this.stopMicrophoneMonitor();
    }
  }

  private stopMicrophoneMonitor(): void {
    if (this.analyserFrame !== null) {
      window.cancelAnimationFrame(this.analyserFrame);
    }
    this.analyserFrame = null;
    void this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
    this.smoothedMicrophoneLevel = 0;
    this.updateMicrophoneLevel(0);
  }

  private updateMicrophoneLevel(level: number): void {
    const nextLevel = Math.round(level * 100) / 100;
    if (nextLevel === this.microphoneLevel) return;
    this.microphoneLevel = nextLevel;
    this.callbacks.onMicrophoneLevel(nextLevel);
  }
}

export function supportsSpeakerSelection(): boolean {
  return typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;
}
