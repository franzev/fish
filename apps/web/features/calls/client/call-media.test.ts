import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  disconnectMock,
  roomEventHandlers,
  roomInstances,
  roomOptions,
  remoteParticipantsMock,
  getTrackPublicationMock,
  setPublishingQualityMock,
  setCameraEnabledMock,
} = vi.hoisted(() => ({
  disconnectMock: vi.fn(async () => undefined),
  roomEventHandlers: new Map<string, (...args: unknown[]) => void>(),
  roomInstances: [] as Array<Record<string, unknown>>,
  roomOptions: [] as unknown[],
  remoteParticipantsMock: new Map<string, Record<string, unknown>>(),
  getTrackPublicationMock: vi.fn(),
  setPublishingQualityMock: vi.fn(),
  setCameraEnabledMock: vi.fn(async () => undefined),
}));

vi.mock("livekit-client", () => {
  class Room {
    static getLocalDevices = vi.fn(async () => []);
    adaptiveStream = true;
    canPlaybackAudio = true;
    dynacast = true;
    remoteParticipants = remoteParticipantsMock;
    localParticipant = {
      identity: "user-1",
      audioLevel: 0,
      isMicrophoneEnabled: true,
      setMicrophoneEnabled: vi.fn(async () => undefined),
      setCameraEnabled: setCameraEnabledMock,
      getTrackPublication: getTrackPublicationMock,
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
      Source: { Camera: "camera", Microphone: "microphone" },
    },
    VideoQuality: { LOW: 0, MEDIUM: 1, HIGH: 2 },
    VideoPresets: {
      h360: {
        width: 640,
        height: 360,
        encoding: { maxBitrate: 450_000, maxFramerate: 20 },
        resolution: { width: 640, height: 360, frameRate: 20 },
      },
      h720: {
        width: 1280,
        height: 720,
        encoding: { maxBitrate: 1_700_000, maxFramerate: 30 },
        resolution: { width: 1280, height: 720, frameRate: 30 },
      },
      h1080: {
        width: 1920,
        height: 1080,
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
    onRemoteMuteChanged: vi.fn(),
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
    remoteParticipantsMock.clear();
    getTrackPublicationMock.mockReset();
    getTrackPublicationMock.mockReturnValue(null);
    setPublishingQualityMock.mockReset();
    setCameraEnabledMock.mockReset();
    setCameraEnabledMock.mockRejectedValue(new Error("camera unavailable"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses adaptive 720p simulcast for one-to-one calls", async () => {
    const media = new LiveKitCallMedia(callbacks());

    await expect(
      media.connect(
        "call-1",
        { serverUrl: "wss://calls.example", participantToken: "token" },
        { microphone: false, camera: false }
      )
    ).resolves.toBeUndefined();

    expect(roomOptions[0]).toMatchObject({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 1280, height: 720, frameRate: 30 },
      },
      publishDefaults: {
        simulcast: true,
        videoEncoding: { maxBitrate: 1_700_000, maxFramerate: 30 },
        degradationPreference: "maintain-resolution",
      },
    });
  });

  it("reports smoothed local and remote microphone levels during a call", async () => {
    let frame: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    const mediaCallbacks = callbacks();
    const media = new LiveKitCallMedia(mediaCallbacks);
    const runFrame = (time: number) => {
      const currentFrame = frame;
      if (!currentFrame) throw new Error("Expected the speaking monitor frame");
      currentFrame(time);
    };

    await media.connect(
      "call-1",
      { serverUrl: "wss://calls.example", participantToken: "token" },
      { microphone: true, camera: false }
    );
    const participant = roomInstances[0]?.localParticipant as {
      audioLevel: number;
      isMicrophoneEnabled: boolean;
    };
    participant.audioLevel = 0.09;
    remoteParticipantsMock.set("user-2", {
      identity: "user-2",
      audioLevel: 0.06,
    });
    roomEventHandlers.get("activeSpeakersChanged")?.([
      { identity: "user-2" },
    ]);
    runFrame(0);

    expect(mediaCallbacks.onSpeakingChanged).toHaveBeenLastCalledWith(
      "call-1",
      {
        localMicrophoneActive: true,
        localMicrophoneLevel: 0.11,
        remoteSpeaking: true,
        remoteMicrophoneLevel: 0.07,
      }
    );
    await media.disconnect();
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
    const remotePublication = {
      source: "camera",
      setVideoDimensions: vi.fn(),
      setVideoQuality: vi.fn(),
    };

    await media.connect(
      "call-1",
      { serverUrl: "wss://calls.example", participantToken: "token" },
      { microphone: false, camera: false }
    );
    roomEventHandlers.get("trackSubscribed")?.(remoteTrack, remotePublication);

    expect(mediaCallbacks.onRemoteVideoChanged).toHaveBeenCalledWith(remoteTrack);
    expect(remotePublication.setVideoQuality).toHaveBeenCalledWith(2);
  });

  it("reports when the remote microphone is muted and unmuted", async () => {
    const mediaCallbacks = callbacks();
    const media = new LiveKitCallMedia(mediaCallbacks);
    const remoteParticipant = { identity: "user-2" };
    const remoteMicrophone = { source: "microphone" };

    await media.connect(
      "call-1",
      { serverUrl: "wss://calls.example", participantToken: "token" },
      { microphone: false, camera: false }
    );
    roomEventHandlers.get("trackMuted")?.(remoteMicrophone, remoteParticipant);
    roomEventHandlers.get("trackUnmuted")?.(remoteMicrophone, remoteParticipant);

    expect(mediaCallbacks.onRemoteMuteChanged).toHaveBeenNthCalledWith(
      1,
      "call-1",
      true
    );
    expect(mediaCallbacks.onRemoteMuteChanged).toHaveBeenNthCalledWith(
      2,
      "call-1",
      false
    );
  });

  it("caps a remote camera that subscribes after data saver is selected", async () => {
    const media = new LiveKitCallMedia(callbacks(), "data-saver");
    const remoteTrack = {
      kind: "video",
      mediaStreamTrack: {} as MediaStreamTrack,
    };
    const remotePublication = {
      source: "camera",
      setVideoDimensions: vi.fn(),
      setVideoQuality: vi.fn(),
    };

    await media.connect(
      "call-1",
      { serverUrl: "wss://calls.example", participantToken: "token" },
      { microphone: false, camera: false }
    );
    roomEventHandlers.get("trackSubscribed")?.(remoteTrack, remotePublication);

    expect(remotePublication.setVideoDimensions).toHaveBeenCalledWith({
      width: 640,
      height: 360,
    });
  });

  it("caps sent and received video when data saver is selected", async () => {
    const localPublication = {
      source: "camera",
      videoTrack: { setPublishingQuality: setPublishingQualityMock },
    };
    const remotePublication = {
      source: "camera",
      setVideoDimensions: vi.fn(),
      setVideoQuality: vi.fn(),
    };
    getTrackPublicationMock.mockReturnValue(localPublication);
    remoteParticipantsMock.set("user-2", {
      videoTrackPublications: new Map([["remote-camera", remotePublication]]),
    });
    const media = new LiveKitCallMedia(callbacks(), "data-saver");

    await media.connect(
      "call-1",
      { serverUrl: "wss://calls.example", participantToken: "token" },
      { microphone: false, camera: false }
    );

    expect(setPublishingQualityMock).toHaveBeenCalledWith(1);
    expect(remotePublication.setVideoDimensions).toHaveBeenCalledWith({
      width: 640,
      height: 360,
    });

    media.setVideoQualityPreference("auto");

    expect(setPublishingQualityMock).toHaveBeenLastCalledWith(2);
    expect(remotePublication.setVideoQuality).toHaveBeenCalledWith(2);
  });

  it("applies data saver to camera tracks published after selection", async () => {
    vi.stubGlobal(
      "MediaStream",
      class {}
    );
    const media = new LiveKitCallMedia(callbacks(), "data-saver");
    const publication = {
      source: "camera",
      track: { mediaStreamTrack: {} as MediaStreamTrack },
      videoTrack: { setPublishingQuality: setPublishingQualityMock },
    };
    getTrackPublicationMock.mockReturnValue(publication);

    await media.connect(
      "call-1",
      { serverUrl: "wss://calls.example", participantToken: "token" },
      { microphone: false, camera: false }
    );
    setPublishingQualityMock.mockClear();
    roomEventHandlers.get("localTrackPublished")?.(publication);

    expect(setPublishingQualityMock).toHaveBeenCalledWith(1);
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
