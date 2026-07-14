import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  disconnectMock,
  roomEventHandlers,
  roomInstances,
  roomOptions,
  setCameraEnabledMock,
} = vi.hoisted(() => ({
  disconnectMock: vi.fn(async () => undefined),
  roomEventHandlers: new Map<string, (...args: unknown[]) => void>(),
  roomInstances: [] as Array<Record<string, unknown>>,
  roomOptions: [] as unknown[],
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
    on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      roomEventHandlers.set(event, handler);
      return this;
    });
    switchActiveDevice = vi.fn(async () => undefined);
    startAudio = vi.fn(async () => undefined);

    constructor(options: unknown) {
      roomOptions.push(options);
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
    VideoPresets: {
      h360: {
        encoding: { maxBitrate: 450_000, maxFramerate: 20 },
        resolution: { width: 640, height: 360, frameRate: 20 },
      },
      h720: {
        encoding: { maxBitrate: 1_700_000, maxFramerate: 30 },
        resolution: { width: 1280, height: 720, frameRate: 30 },
      },
      h1080: {
        encoding: { maxBitrate: 3_000_000, maxFramerate: 30 },
        resolution: { width: 1920, height: 1080, frameRate: 30 },
      },
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
    roomEventHandlers.clear();
    roomInstances.length = 0;
    roomOptions.length = 0;
    setCameraEnabledMock.mockReset();
    setCameraEnabledMock.mockRejectedValue(new Error("camera unavailable"));
  });

  it("requests a 1080p camera layer and preserves adaptive simulcast", async () => {
    const media = new LiveKitCallMedia(callbacks());

    await expect(
      media.connect(
        "call-1",
        { serverUrl: "wss://calls.example", participantToken: "token" },
        { microphone: false, camera: false }
      )
    ).resolves.toBeUndefined();

    expect(roomOptions[0]).toMatchObject({
      adaptiveStream: { pixelDensity: "screen" },
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 1920, height: 1080, frameRate: 30 },
      },
      publishDefaults: {
        simulcast: true,
        videoEncoding: { maxBitrate: 3_000_000, maxFramerate: 30 },
        videoSimulcastLayers: [
          {
            encoding: { maxBitrate: 450_000, maxFramerate: 20 },
            resolution: { width: 640, height: 360, frameRate: 20 },
          },
          {
            encoding: { maxBitrate: 1_700_000, maxFramerate: 30 },
            resolution: { width: 1280, height: 720, frameRate: 30 },
          },
        ],
      },
    });
  });

  it("passes the remote LiveKit video track through for adaptive attachment", async () => {
    const mediaCallbacks = callbacks();
    const media = new LiveKitCallMedia(mediaCallbacks);
    const remoteTrack = {
      kind: "video",
      attach: vi.fn(),
      detach: vi.fn(),
      mediaStreamTrack: {} as MediaStreamTrack,
    };

    await media.connect(
      "call-1",
      { serverUrl: "wss://calls.example", participantToken: "token" },
      { microphone: false, camera: false }
    );
    roomEventHandlers.get("trackSubscribed")?.(remoteTrack);

    expect(mediaCallbacks.onRemoteVideoChanged).toHaveBeenCalledWith(remoteTrack);
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
