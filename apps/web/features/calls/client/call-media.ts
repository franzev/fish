"use client";

import type { CallConnection } from "@/lib/services";
import {
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type RemoteTrack,
} from "livekit-client";

export interface CallMediaCallbacks {
  onConnected(callId: string): void;
  onReconnecting(callId: string): void;
  onReconnected(callId: string): void;
  onDisconnected(callId: string): void;
  onAudioPlaybackChanged(blocked: boolean): void;
  onSpeakingChanged(
    callId: string,
    state: { localMicrophoneActive: boolean; remoteSpeaking: boolean }
  ): void;
  onLocalVideoChanged(stream: MediaStream | null): void;
  onRemoteVideoChanged(stream: MediaStream | null): void;
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
  private speakingInterval: ReturnType<typeof setInterval> | null = null;
  private localMicrophoneActive = false;
  private remoteSpeaking = false;
  private localActiveUntil = 0;

  constructor(private readonly callbacks: CallMediaCallbacks) {}

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
    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    this.callId = callId;
    this.canPublishMicrophone = publish.microphone;
    this.canPublishCamera = publish.camera;
    this.intentionalDisconnect = false;
    this.bind(room, callId);
    await room.connect(connection.serverUrl, connection.participantToken, {
      autoSubscribe: true,
    });
    if (publish.microphone) await this.enableMicrophone();
    if (publish.camera) await this.enableCamera();
    if (room.remoteParticipants.size > 0) this.callbacks.onConnected(callId);
    this.callbacks.onAudioPlaybackChanged(!room.canPlaybackAudio);
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
      this.updateSpeaking(this.callId, false, this.remoteSpeaking);
    }
  }

  async enableCamera(): Promise<void> {
    await this.setCameraEnabled(true);
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setCameraEnabled(enabled);
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
    if (callId) this.updateSpeaking(callId, false, false);
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
        this.updateSpeaking(callId, this.localMicrophoneActive, false);
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
        this.callbacks.onCameraChanged(false);
        this.clearAttachedMedia();
        this.callbacks.onDisconnected(callId);
      }
    });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      this.callbacks.onAudioPlaybackChanged(!room.canPlaybackAudio);
    });
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video) {
        this.callbacks.onRemoteVideoChanged(
          new MediaStream([track.mediaStreamTrack])
        );
        return;
      }
      if (track.kind !== Track.Kind.Audio) return;
      const element = track.attach();
      element.dataset.fishCallAudio = "true";
      element.hidden = true;
      document.body.append(element);
      void element.play().catch(() => {
        this.callbacks.onAudioPlaybackChanged(true);
      });
    });
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
          publication.source === Track.Source.Camera &&
          publication.track
        ) {
          this.callbacks.onRemoteVideoChanged(
            new MediaStream([publication.track.mediaStreamTrack])
          );
        }
      }
    );
  }

  private startSpeakingMonitor(room: Room, callId: string) {
    if (this.speakingInterval) return;
    this.speakingInterval = setInterval(() => {
      if (this.room !== room) return;
      const now = Date.now();
      if (
        room.localParticipant.isMicrophoneEnabled &&
        room.localParticipant.audioLevel >= 0.025
      ) {
        this.localActiveUntil = now + 250;
      }
      const microphoneActive =
        room.localParticipant.isMicrophoneEnabled &&
        now < this.localActiveUntil;
      this.updateSpeaking(callId, microphoneActive, this.remoteSpeaking);
    }, 100);
  }

  private stopSpeakingMonitor() {
    if (this.speakingInterval) clearInterval(this.speakingInterval);
    this.speakingInterval = null;
    this.localActiveUntil = 0;
  }

  private updateSpeaking(
    callId: string,
    localMicrophoneActive: boolean,
    remoteSpeaking: boolean
  ) {
    if (
      localMicrophoneActive === this.localMicrophoneActive &&
      remoteSpeaking === this.remoteSpeaking
    ) return;
    this.localMicrophoneActive = localMicrophoneActive;
    this.remoteSpeaking = remoteSpeaking;
    this.callbacks.onSpeakingChanged(callId, {
      localMicrophoneActive,
      remoteSpeaking,
    });
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
