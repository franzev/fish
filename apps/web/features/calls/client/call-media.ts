"use client";

import { reportOperationalError } from "@/lib/observability/reporter";
import type { CallConnection } from "@/lib/services";
import {
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  VideoPresets,
  type LocalTrackPublication,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteVideoTrack,
} from "livekit-client";
import type { VideoQualityPreference } from "./video-quality-preference";

export interface CallMediaCallbacks {
  onConnected(callId: string): void;
  onReconnecting(callId: string): void;
  onReconnected(callId: string): void;
  onDisconnected(callId: string): void;
  onAudioPlaybackChanged(blocked: boolean): void;
  onSpeakingChanged(
    callId: string,
    state: {
      localMicrophoneActive: boolean;
      localMicrophoneLevel: number;
      remoteSpeaking: boolean;
      remoteMicrophoneLevel: number;
    }
  ): void;
  onRemoteMuteChanged(callId: string, muted: boolean): void;
  onLocalVideoChanged(stream: MediaStream | null): void;
  onRemoteVideoChanged(track: RemoteVideoTrack | null): void;
  onCameraChanged(enabled: boolean): void;
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
}

export class LiveKitCallMedia {
  private room: Room | null = null;
  private callId: string | null = null;
  private intentionalDisconnect = false;
  private canPublishMicrophone = false;
  private canPublishCamera = false;
  private speakingFrame: number | null = null;
  private localMicrophoneActive = false;
  private localMicrophoneLevel = 0;
  private remoteSpeaking = false;
  private remoteMicrophoneLevel = 0;
  private remoteMuted = false;
  private localActiveUntil = 0;
  private videoQualityPreference: VideoQualityPreference;

  constructor(
    private readonly callbacks: CallMediaCallbacks,
    videoQualityPreference: VideoQualityPreference = "auto"
  ) {
    this.videoQualityPreference = videoQualityPreference;
  }

  async connect(
    callId: string,
    connection: CallConnection,
    publish: { microphone: boolean; camera: boolean }
  ): Promise<void> {
    if (this.callId === callId && this.room) {
      if (
        (!publish.microphone || this.canPublishMicrophone) &&
        (!publish.camera || this.canPublishCamera)
      ) {
        if (publish.microphone) await this.enableMicrophone();
        if (publish.camera) await this.enableCamera();
        return;
      }
    }
    await this.disconnect();
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      publishDefaults: {
        simulcast: true,
        videoEncoding: VideoPresets.h720.encoding,
        degradationPreference: "maintain-resolution",
      },
    });
    this.room = room;
    this.callId = callId;
    this.canPublishMicrophone = publish.microphone;
    this.canPublishCamera = publish.camera;
    this.intentionalDisconnect = false;
    this.bind(room, callId);
    try {
      await room.connect(connection.serverUrl, connection.participantToken, {
        autoSubscribe: true,
      });
      if (publish.microphone) await this.enableMicrophone();
      if (publish.camera) await this.enableCamera();
      this.applyVideoQuality(room);
      if (room.remoteParticipants.size > 0) this.callbacks.onConnected(callId);
      this.callbacks.onAudioPlaybackChanged(!room.canPlaybackAudio);
    } catch (error) {
      reportOperationalError(error, {
        operation: "calls.media.connect",
        handled: true,
        recoverable: false,
        runtime: "browser",
      });
      if (this.room === room) await this.disconnect();
      else await room.disconnect(true);
      throw error;
    }
  }

  async enableMicrophone(): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(true, {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    if (this.callId) this.startSpeakingMonitor(this.room, this.callId);
  }

  async setMuted(muted: boolean): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(!muted, {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    if (muted && this.callId) {
      this.localActiveUntil = 0;
      this.updateSpeaking(this.callId, false, this.remoteSpeaking, 0);
    }
  }

  async enableCamera(): Promise<void> {
    await this.setCameraEnabled(true);
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setCameraEnabled(enabled);
    if (enabled) this.applyLocalVideoQuality(this.room);
    const publication = this.room.localParticipant.getTrackPublication(
      Track.Source.Camera
    );
    this.callbacks.onLocalVideoChanged(
      enabled && publication?.track
        ? new MediaStream([publication.track.mediaStreamTrack])
        : null
    );
    this.callbacks.onCameraChanged(enabled);
  }

  setVideoQualityPreference(preference: VideoQualityPreference): void {
    this.videoQualityPreference = preference;
    if (this.room) this.applyVideoQuality(this.room);
  }

  async startAudio(): Promise<void> {
    await this.room?.startAudio();
    this.callbacks.onAudioPlaybackChanged(!(this.room?.canPlaybackAudio ?? true));
  }

  async microphones(): Promise<AudioDeviceOption[]> {
    return (await Room.getLocalDevices("audioinput")).map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${index + 1}`,
    }));
  }

  async switchMicrophone(deviceId: string): Promise<void> {
    await this.room?.switchActiveDevice("audioinput", deviceId, true);
  }

  async disconnect(): Promise<void> {
    const room = this.room;
    const callId = this.callId;
    this.intentionalDisconnect = true;
    this.stopSpeakingMonitor();
    if (callId) this.updateSpeaking(callId, false, false, 0, 0);
    if (callId) this.updateRemoteMuted(callId, false);
    this.room = null;
    this.callId = null;
    this.canPublishMicrophone = false;
    this.canPublishCamera = false;
    this.callbacks.onLocalVideoChanged(null);
    this.callbacks.onRemoteVideoChanged(null);
    this.callbacks.onCameraChanged(false);
    if (room) await room.disconnect(true);
    this.clearAttachedMedia();
  }

  private clearAttachedMedia() {
    document.querySelectorAll("[data-fish-call-audio]").forEach((node) => {
      if (node instanceof HTMLMediaElement) {
        node.pause();
        node.srcObject = null;
      }
      node.remove();
    });
  }

  private bind(room: Room, callId: string) {
    room.on(RoomEvent.ParticipantConnected, () => {
      this.callbacks.onConnected(callId);
    });
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const remoteSpeaking = speakers.some(
        (speaker) => speaker.identity !== room.localParticipant.identity
      );
      this.updateSpeaking(
        callId,
        this.localMicrophoneActive,
        remoteSpeaking
      );
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      if (room.remoteParticipants.size === 0) {
        this.updateSpeaking(
          callId,
          this.localMicrophoneActive,
          false,
          undefined,
          0
        );
        this.updateRemoteMuted(callId, false);
      }
    });
    room.on(RoomEvent.Reconnecting, () => {
      this.callbacks.onReconnecting(callId);
    });
    room.on(RoomEvent.Reconnected, () => {
      this.callbacks.onReconnected(callId);
    });
    room.on(RoomEvent.Disconnected, () => {
      if (!this.intentionalDisconnect) {
        this.stopSpeakingMonitor();
        this.room = null;
        this.callId = null;
        this.canPublishMicrophone = false;
        this.canPublishCamera = false;
        this.callbacks.onLocalVideoChanged(null);
        this.callbacks.onRemoteVideoChanged(null);
        this.updateRemoteMuted(callId, false);
        this.callbacks.onCameraChanged(false);
        this.clearAttachedMedia();
        this.callbacks.onDisconnected(callId);
      }
    });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      this.callbacks.onAudioPlaybackChanged(!room.canPlaybackAudio);
    });
    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, publication: RemoteTrackPublication) => {
        if (track.kind === Track.Kind.Video) {
          this.applyRemoteVideoQuality(publication);
          this.callbacks.onRemoteVideoChanged(track as RemoteVideoTrack);
          return;
        }
        if (track.kind !== Track.Kind.Audio) return;
        this.updateRemoteMuted(callId, publication.isMuted);
        const element = track.attach();
        element.dataset.fishCallAudio = "true";
        element.hidden = true;
        document.body.append(element);
        void element.play().catch(() => {
          this.callbacks.onAudioPlaybackChanged(true);
        });
      }
    );
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video) {
        this.callbacks.onRemoteVideoChanged(null);
        return;
      }
      track.detach().forEach((element) => element.remove());
    });
    room.on(
      RoomEvent.LocalTrackPublished,
      (publication: LocalTrackPublication) => {
        if (
          publication.source === Track.Source.Camera &&
          publication.track
        ) {
          this.applyLocalVideoQuality(room);
          this.callbacks.onLocalVideoChanged(
            new MediaStream([publication.track.mediaStreamTrack])
          );
          this.callbacks.onCameraChanged(true);
        }
      }
    );
    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.source === Track.Source.Camera) {
        this.callbacks.onLocalVideoChanged(null);
        this.callbacks.onCameraChanged(false);
      }
    });
    room.on(
      RoomEvent.TrackMuted,
      (publication, participant) => {
        if (
          participant.identity !== room.localParticipant.identity &&
          publication.source === Track.Source.Microphone
        ) {
          this.updateSpeaking(
            callId,
            this.localMicrophoneActive,
            false,
            undefined,
            0
          );
          this.updateRemoteMuted(callId, true);
        }
        if (
          participant.identity !== room.localParticipant.identity &&
          publication.source === Track.Source.Camera
        ) {
          this.callbacks.onRemoteVideoChanged(null);
        }
      }
    );
    room.on(
      RoomEvent.TrackUnmuted,
      (publication, participant) => {
        if (
          participant.identity !== room.localParticipant.identity &&
          publication.source === Track.Source.Microphone
        ) {
          this.updateRemoteMuted(callId, false);
        }
        if (
          participant.identity !== room.localParticipant.identity &&
          publication.source === Track.Source.Camera &&
          publication.track
        ) {
          this.applyRemoteVideoQuality(publication as RemoteTrackPublication);
          this.callbacks.onRemoteVideoChanged(
            publication.track as RemoteVideoTrack
          );
        }
      }
    );
  }

  private applyVideoQuality(room: Room): void {
    this.applyLocalVideoQuality(room);
    room.remoteParticipants.forEach((participant) => {
      participant.videoTrackPublications.forEach((publication) => {
        if (publication.source === Track.Source.Camera) {
          this.applyRemoteVideoQuality(publication);
        }
      });
    });
  }

  private applyLocalVideoQuality(room: Room): void {
    const publication = room.localParticipant.getTrackPublication(
      Track.Source.Camera
    );
    publication?.videoTrack?.setPublishingQuality(
      this.videoQualityPreference === "data-saver"
        ? VideoQuality.MEDIUM
        : VideoQuality.HIGH
    );
  }

  private applyRemoteVideoQuality(publication: RemoteTrackPublication): void {
    if (publication.source !== Track.Source.Camera) return;

    if (this.videoQualityPreference === "data-saver") {
      publication.setVideoDimensions({
        width: VideoPresets.h360.width,
        height: VideoPresets.h360.height,
      });
      return;
    }

    publication.setVideoQuality(VideoQuality.HIGH);
  }

  private startSpeakingMonitor(room: Room, callId: string) {
    if (this.speakingFrame !== null) return;
    const readLevel = () => {
      if (this.room !== room) return;
      const now = Date.now();
      const measuredLevel = room.localParticipant.isMicrophoneEnabled
        ? Math.min(1, room.localParticipant.audioLevel / 0.3)
        : 0;
      const response = measuredLevel > this.localMicrophoneLevel ? 0.35 : 0.12;
      const smoothedLevel = this.localMicrophoneLevel +
        (measuredLevel - this.localMicrophoneLevel) * response;
      let measuredRemoteLevel = 0;
      if (!this.remoteMuted) {
        room.remoteParticipants.forEach((participant) => {
          measuredRemoteLevel = Math.max(
            measuredRemoteLevel,
            Math.min(1, participant.audioLevel / 0.3)
          );
        });
      }
      const remoteResponse = measuredRemoteLevel > this.remoteMicrophoneLevel
        ? 0.35
        : 0.12;
      const smoothedRemoteLevel = this.remoteMicrophoneLevel +
        (measuredRemoteLevel - this.remoteMicrophoneLevel) * remoteResponse;
      if (
        room.localParticipant.isMicrophoneEnabled &&
        room.localParticipant.audioLevel >= 0.025
      ) {
        this.localActiveUntil = now + 250;
      }
      const microphoneActive =
        room.localParticipant.isMicrophoneEnabled &&
        now < this.localActiveUntil;
      this.updateSpeaking(
        callId,
        microphoneActive,
        this.remoteSpeaking,
        smoothedLevel < 0.01 ? 0 : smoothedLevel,
        smoothedRemoteLevel < 0.01 ? 0 : smoothedRemoteLevel
      );
      this.speakingFrame = window.requestAnimationFrame(readLevel);
    };
    this.speakingFrame = window.requestAnimationFrame(readLevel);
  }

  private stopSpeakingMonitor() {
    if (this.speakingFrame !== null) {
      window.cancelAnimationFrame(this.speakingFrame);
    }
    this.speakingFrame = null;
    this.localActiveUntil = 0;
  }

  private updateSpeaking(
    callId: string,
    localMicrophoneActive: boolean,
    remoteSpeaking: boolean,
    localMicrophoneLevel = this.localMicrophoneLevel,
    remoteMicrophoneLevel = this.remoteMicrophoneLevel
  ) {
    const nextLevel = Math.round(localMicrophoneLevel * 100) / 100;
    const nextRemoteLevel = Math.round(remoteMicrophoneLevel * 100) / 100;
    if (
      localMicrophoneActive === this.localMicrophoneActive &&
      nextLevel === this.localMicrophoneLevel &&
      remoteSpeaking === this.remoteSpeaking &&
      nextRemoteLevel === this.remoteMicrophoneLevel
    ) return;
    this.localMicrophoneActive = localMicrophoneActive;
    this.localMicrophoneLevel = nextLevel;
    this.remoteSpeaking = remoteSpeaking;
    this.remoteMicrophoneLevel = nextRemoteLevel;
    this.callbacks.onSpeakingChanged(callId, {
      localMicrophoneActive,
      localMicrophoneLevel: nextLevel,
      remoteSpeaking,
      remoteMicrophoneLevel: nextRemoteLevel,
    });
  }

  private updateRemoteMuted(callId: string, muted: boolean): void {
    if (muted === this.remoteMuted) return;
    this.remoteMuted = muted;
    this.callbacks.onRemoteMuteChanged(callId, muted);
  }
}

export async function requestMediaPermission(
  kind: "audio" | "video"
): Promise<
  "granted" | "denied" | "unavailable"
> {
  if (!navigator.mediaDevices?.getUserMedia) return "unavailable";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: kind === "video",
    });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch (error) {
    return error instanceof DOMException && error.name === "NotFoundError"
      ? "unavailable"
      : "denied";
  }
}
