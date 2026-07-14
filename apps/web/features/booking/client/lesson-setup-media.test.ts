import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectMock,
  disconnectMock,
  publishTrackMock,
} = vi.hoisted(() => ({
  connectMock: vi.fn(async () => undefined),
  disconnectMock: vi.fn(async () => undefined),
  publishTrackMock: vi.fn(async () => undefined),
}));

vi.mock("livekit-client", () => ({
  Room: class Room {
    localParticipant = { publishTrack: publishTrackMock };
    connect = connectMock;
    disconnect = disconnectMock;
  },
  Track: {
    Source: {
      Microphone: "microphone",
      Camera: "camera",
    },
  },
}));

import { LessonSetupMediaSession } from "./lesson-setup-media";

class FakeTrack {
  enabled = true;
  stop = vi.fn();
  cloneTrack: FakeTrack | null = null;

  constructor(
    readonly kind: "audio" | "video",
    private readonly deviceId: string
  ) {}

  addEventListener() {}

  getSettings() {
    return { deviceId: this.deviceId };
  }

  clone() {
    this.cloneTrack = new FakeTrack(this.kind, `${this.deviceId}-clone`);
    return this.cloneTrack;
  }
}

class FakeMediaStream {
  constructor(private readonly tracks: FakeTrack[] = []) {}
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === "video"); }
}

const originalMediaStream = globalThis.MediaStream;
Object.defineProperty(globalThis, "MediaStream", {
  configurable: true,
  value: FakeMediaStream,
});

afterAll(() => {
  Object.defineProperty(globalThis, "MediaStream", {
    configurable: true,
    value: originalMediaStream,
  });
});

function installMediaDevices(getUserMedia: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: vi.fn(async () => [
        { deviceId: "mic-1", kind: "audioinput", label: "USB microphone" },
        { deviceId: "cam-1", kind: "videoinput", label: "Desk camera" },
      ]),
    },
  });
}

function callbacks() {
  return {
    onMicrophoneLevel: vi.fn(),
    onTrackEnded: vi.fn(),
  };
}

describe("LessonSetupMediaSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps a local camera and microphone stream alive until cleanup", async () => {
    const audio = new FakeTrack("audio", "mic-1");
    const video = new FakeTrack("video", "cam-1");
    installMediaDevices(vi.fn(async () => new FakeMediaStream([audio, video])));
    const session = new LessonSetupMediaSession(callbacks());

    const snapshot = await session.start();
    expect(snapshot.microphoneId).toBe("mic-1");
    expect(snapshot.cameraId).toBe("cam-1");
    expect(snapshot.devices.map((device) => device.label))
      .toEqual(["USB microphone", "Desk camera"]);
    expect(audio.stop).not.toHaveBeenCalled();

    session.stop();
    expect(audio.stop).toHaveBeenCalledOnce();
    expect(video.stop).toHaveBeenCalledOnce();
  });

  it("maps normal speech below the ceiling and eases the meter down", async () => {
    const audio = new FakeTrack("audio", "mic-1");
    installMediaDevices(vi.fn(async () => new FakeMediaStream([audio])));
    let amplitude = 16;
    let frame: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal("AudioContext", class AudioContext {
      createAnalyser() {
        return {
          fftSize: 256,
          getByteTimeDomainData(samples: Uint8Array) {
            samples.forEach((_, index) => {
              samples[index] = 128 + (index % 2 === 0 ? amplitude : -amplitude);
            });
          },
        };
      }
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      close = vi.fn(async () => undefined);
    });
    const handlers = callbacks();
    const session = new LessonSetupMediaSession(handlers);
    const runFrame = (time: number) => {
      const currentFrame = frame;
      if (!currentFrame) throw new Error("Expected the microphone monitor frame");
      currentFrame(time);
    };

    await session.start();
    expect(frame).not.toBeNull();
    runFrame(0);
    expect(handlers.onMicrophoneLevel).toHaveBeenLastCalledWith(0.28);

    amplitude = 0;
    runFrame(16);
    expect(handlers.onMicrophoneLevel).toHaveBeenLastCalledWith(0.25);
    session.stop();
  });

  it("falls back to audio when no camera is available", async () => {
    const audio = new FakeTrack("audio", "mic-1");
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new DOMException("missing", "NotFoundError"))
      .mockResolvedValueOnce(new FakeMediaStream([audio]));
    installMediaDevices(getUserMedia);
    const session = new LessonSetupMediaSession(callbacks());

    const snapshot = await session.start();
    expect(snapshot.stream.getVideoTracks()).toHaveLength(0);
    expect(snapshot.stream.getAudioTracks()).toHaveLength(1);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("publishes cloned tracks to a private diagnostic room and preserves the preview", async () => {
    const audio = new FakeTrack("audio", "mic-1");
    const video = new FakeTrack("video", "cam-1");
    installMediaDevices(vi.fn(async () => new FakeMediaStream([audio, video])));
    const session = new LessonSetupMediaSession(callbacks());
    await session.start();

    await session.checkConnection({
      serverUrl: "wss://calls.example",
      participantToken: "short-token",
    });

    expect(connectMock).toHaveBeenCalledWith(
      "wss://calls.example",
      "short-token",
      { autoSubscribe: false }
    );
    expect(publishTrackMock).toHaveBeenCalledTimes(2);
    expect(publishTrackMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "audio" }),
      { source: "microphone" }
    );
    expect(publishTrackMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "video" }),
      { source: "camera" }
    );
    expect(disconnectMock).toHaveBeenCalledWith(true);
    expect(audio.stop).not.toHaveBeenCalled();
    expect(video.stop).not.toHaveBeenCalled();
    expect(audio.cloneTrack?.stop).toHaveBeenCalledOnce();
    expect(video.cloneTrack?.stop).toHaveBeenCalledOnce();
  });

  it("switches one input without interrupting the other device", async () => {
    const oldAudio = new FakeTrack("audio", "mic-1");
    const video = new FakeTrack("video", "cam-1");
    const newAudio = new FakeTrack("audio", "mic-2");
    const getUserMedia = vi.fn()
      .mockResolvedValueOnce(new FakeMediaStream([oldAudio, video]))
      .mockResolvedValueOnce(new FakeMediaStream([newAudio]));
    installMediaDevices(getUserMedia);
    const session = new LessonSetupMediaSession(callbacks());
    await session.start();

    const snapshot = await session.switchInput("audioinput", "mic-2");
    expect(snapshot.microphoneId).toBe("mic-2");
    expect(snapshot.cameraId).toBe("cam-1");
    expect(oldAudio.stop).toHaveBeenCalledOnce();
    expect(video.stop).not.toHaveBeenCalled();
  });
});
