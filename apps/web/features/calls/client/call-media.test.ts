import { beforeEach, describe, expect, it, vi } from "vitest";

const { disconnectMock, roomInstances, setCameraEnabledMock } = vi.hoisted(() => ({
  disconnectMock: vi.fn(async () => undefined),
  roomInstances: [] as Array<Record<string, unknown>>,
  setCameraEnabledMock: vi.fn(async () => undefined),
}));

vi.mock("livekit-client", () => {
  class Room {
    static getLocalDevices = vi.fn(async () => []);
    adaptiveStream = true;
    canPlaybackAudio = true;
    dynacast = true;
    remoteParticipants = new Map();
    localParticipant = {
      identity: "user-1",
      audioLevel: 0,
      isMicrophoneEnabled: true,
      setMicrophoneEnabled: vi.fn(async () => undefined),
      setCameraEnabled: setCameraEnabledMock,
      getTrackPublication: vi.fn(() => null),
    };
    connect = vi.fn(async () => undefined);
    disconnect = disconnectMock;
    on = vi.fn(() => this);
    switchActiveDevice = vi.fn(async () => undefined);
    startAudio = vi.fn(async () => undefined);

    constructor() {
      roomInstances.push(this as unknown as Record<string, unknown>);
    }
  }

  return {
    Room,
    RoomEvent: {
      ActiveSpeakersChanged: "activeSpeakersChanged",
      AudioPlaybackStatusChanged: "audioPlaybackStatusChanged",
      Disconnected: "disconnected",
      LocalTrackPublished: "localTrackPublished",
      LocalTrackUnpublished: "localTrackUnpublished",
      ParticipantConnected: "participantConnected",
      ParticipantDisconnected: "participantDisconnected",
      Reconnected: "reconnected",
      Reconnecting: "reconnecting",
      TrackMuted: "trackMuted",
      TrackSubscribed: "trackSubscribed",
      TrackUnmuted: "trackUnmuted",
      TrackUnsubscribed: "trackUnsubscribed",
    },
    Track: {
      Kind: { Audio: "audio", Video: "video" },
      Source: { Camera: "camera" },
    },
  };
});

import { LiveKitCallMedia, type CallMediaCallbacks } from "./call-media";

function callbacks(): CallMediaCallbacks {
  return {
    onConnected: vi.fn(),
    onReconnecting: vi.fn(),
    onReconnected: vi.fn(),
    onDisconnected: vi.fn(),
    onAudioPlaybackChanged: vi.fn(),
    onSpeakingChanged: vi.fn(),
    onLocalVideoChanged: vi.fn(),
    onRemoteVideoChanged: vi.fn(),
    onCameraChanged: vi.fn(),
  };
}

describe("LiveKitCallMedia", () => {
  beforeEach(() => {
    disconnectMock.mockClear();
    roomInstances.length = 0;
    setCameraEnabledMock.mockReset();
    setCameraEnabledMock.mockRejectedValue(new Error("camera unavailable"));
  });

  it("disconnects a partially connected room when camera publication fails", async () => {
    const media = new LiveKitCallMedia(callbacks());

    await expect(
      media.connect(
        "call-1",
        { serverUrl: "wss://calls.example", participantToken: "token" },
        { microphone: true, camera: true }
      )
    ).rejects.toThrow("camera unavailable");

    expect(roomInstances).toHaveLength(1);
    expect(disconnectMock).toHaveBeenCalledOnce();
  });
});
