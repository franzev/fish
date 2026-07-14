import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallCommandService, LessonSlot } from "@/lib/services";
import type { LessonMediaDevice } from "../../client/lesson-setup-media";

const {
  checkConnectionMock,
  deviceChangeListeners,
  playTestSoundMock,
  refreshDevicesMock,
  sessionStartMock,
  sessionStopMock,
  setEnabledMock,
  startLessonCallMock,
  supportsSpeakerSelectionMock,
  mediaCallbacksRef,
} = vi.hoisted(() => ({
  checkConnectionMock: vi.fn(async () => undefined),
  deviceChangeListeners: new Set<EventListener>(),
  playTestSoundMock: vi.fn(async () => undefined),
  refreshDevicesMock: vi.fn<() => Promise<LessonMediaDevice[]>>(async () => []),
  sessionStartMock: vi.fn(),
  sessionStopMock: vi.fn(),
  setEnabledMock: vi.fn(() => true),
  startLessonCallMock: vi.fn(async () => undefined),
  supportsSpeakerSelectionMock: vi.fn(() => false),
  mediaCallbacksRef: { current: null as null | { onMicrophoneLevel(level: number): void } },
}));

vi.mock("@/features/calls", () => ({
  useCall: () => ({
    startLessonCall: startLessonCallMock,
    busy: false,
    notice: null,
  }),
}));

vi.mock("../../client/lesson-setup-media", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../client/lesson-setup-media")
  >();
  return {
    ...actual,
    supportsSpeakerSelection: supportsSpeakerSelectionMock,
    LessonSetupMediaSession: vi.fn(function MockSession(callbacks) {
      mediaCallbacksRef.current = callbacks;
      return {
        start: sessionStartMock,
        stop: sessionStopMock,
        setEnabled: setEnabledMock,
        refreshDevices: refreshDevicesMock,
        switchInput: vi.fn(),
        checkConnection: checkConnectionMock,
        playTestSound: playTestSoundMock,
      };
    }),
  };
});

import { LessonSetupScreen } from "./lesson-setup-screen";

const audioTrack = {
  enabled: true,
  kind: "audio",
};
const videoTrack = {
  enabled: true,
  kind: "video",
};
const stream = {
  getAudioTracks: () => [audioTrack],
  getVideoTracks: () => [videoTrack],
  getTracks: () => [audioTrack, videoTrack],
} as unknown as MediaStream;

const lesson: LessonSlot = {
  id: "11111111-1111-4111-8111-111111111111",
  coachId: "coach-1",
  startsAt: "2026-07-21T10:30:00.000Z",
  endsAt: "2026-07-21T11:20:00.000Z",
  durationMinutes: 50,
  bookedByClientId: "client-1",
  bookedAt: "2026-07-14T00:00:00.000Z",
};

function commands(
  checkMedia: CallCommandService["checkMedia"] = vi.fn(async () => ({
    ok: true as const,
    connection: {
      serverUrl: "wss://calls.example",
      participantToken: "token",
    },
  }))
): CallCommandService {
  const callFailure = vi.fn(async () => ({
    ok: false as const,
    code: "unused",
    notice: "unused",
  }));
  return {
    initiate: callFailure,
    initiateLesson: callFailure,
    checkMedia,
    accept: callFailure,
    reject: callFailure,
    cancel: callFailure,
    end: callFailure,
    join: callFailure,
  };
}

function renderScreen(initialNow: string, commandService = commands()) {
  return render(
    <LessonSetupScreen
      coach={{ id: "coach-1", displayName: "Patricia", avatarUrl: null }}
      lesson={lesson}
      locale="en-US"
      timeZone="Asia/Manila"
      timeFormatPref="24h"
      joinWindowMinutes={10}
      initialNow={initialNow}
      commands={commandService}
    />
  );
}

describe("LessonSetupScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deviceChangeListeners.clear();
    supportsSpeakerSelectionMock.mockReturnValue(false);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        addEventListener: vi.fn((event: string, listener: EventListener) => {
          if (event === "devicechange") deviceChangeListeners.add(listener);
        }),
        removeEventListener: vi.fn((event: string, listener: EventListener) => {
          if (event === "devicechange") deviceChangeListeners.delete(listener);
        }),
      },
    });
    audioTrack.enabled = true;
    videoTrack.enabled = true;
    sessionStartMock.mockResolvedValue({
      stream,
      devices: [],
      microphoneId: "microphone-1",
      cameraId: "camera-1",
    });
  });

  it("runs a private device and connection check before the join window", async () => {
    renderScreen("2026-07-21T08:00:00.000Z");

    expect(screen.getByText("This check is private and won’t notify your coach."))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Done" })).toHaveAttribute("href", "/home");
    expect(screen.queryByRole("button", { name: "Join lesson" }))
      .not.toBeInTheDocument();
    await waitFor(() => expect(checkConnectionMock).toHaveBeenCalledOnce());
    expect(screen.getByText("Camera is working")).toBeInTheDocument();
    expect(screen.getByText("Connection is ready")).toBeInTheDocument();
    expect(startLessonCallMock).not.toHaveBeenCalled();
  });

  it("animates the microphone meter from the live input level", async () => {
    renderScreen("2026-07-21T08:00:00.000Z");
    await waitFor(() => expect(sessionStartMock).toHaveBeenCalledOnce());

    act(() => mediaCallbacksRef.current?.onMicrophoneLevel(0.65));

    expect(await screen.findByText("We can hear you")).toBeInTheDocument();
    const meter = screen.getByText("We can hear you").nextElementSibling;
    expect(meter?.children).toHaveLength(3);
    expect(meter?.firstElementChild).toHaveClass("bg-success");
    expect(meter?.firstElementChild).toHaveStyle({ transform: "scaleY(0.72)" });
    expect(meter?.lastElementChild).toHaveStyle({ transform: "scaleY(0.69)" });
  });

  it("uses current-state icons and action labels for preview media controls", async () => {
    renderScreen("2026-07-21T08:00:00.000Z");

    const muteButton = await screen.findByRole("button", { name: "Mute" });
    const cameraButton = screen.getByRole("button", {
      name: "Turn camera off",
    });
    expect(muteButton).not.toHaveTextContent("Mute");
    expect(cameraButton).not.toHaveTextContent("Turn camera off");
    expect(muteButton).toHaveClass("size-control", "min-h-control", "px-0");
    expect(cameraButton).toHaveClass("size-control", "min-h-control", "px-0");
    expect(screen.getByTestId("lesson-microphone-on-icon")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-camera-on-icon")).toBeInTheDocument();

    fireEvent.click(muteButton);
    fireEvent.click(cameraButton);

    expect(screen.getByRole("button", { name: "Unmute" })).toContainElement(
      screen.getByTestId("lesson-microphone-off-icon")
    );
    expect(
      screen.getByRole("button", { name: "Turn camera on" })
    ).toContainElement(screen.getByTestId("lesson-camera-off-icon"));
  });

  it("refreshes available input and output devices when hardware is connected", async () => {
    supportsSpeakerSelectionMock.mockReturnValue(true);
    sessionStartMock.mockResolvedValueOnce({
      stream,
      devices: [
        { deviceId: "built-in-mic", kind: "audioinput", label: "Built-in microphone" },
        { deviceId: "default", kind: "audiooutput", label: "Built-in speakers" },
      ],
      microphoneId: "built-in-mic",
      cameraId: "",
    });
    refreshDevicesMock.mockResolvedValueOnce([
      { deviceId: "built-in-mic", kind: "audioinput", label: "Built-in microphone" },
      { deviceId: "usb-mic", kind: "audioinput", label: "USB microphone" },
      { deviceId: "default", kind: "audiooutput", label: "Built-in speakers" },
      { deviceId: "usb-headset", kind: "audiooutput", label: "USB headset" },
    ]);

    renderScreen("2026-07-21T08:00:00.000Z");
    await waitFor(() => expect(sessionStartMock).toHaveBeenCalledOnce());
    expect(screen.queryByRole("combobox", { name: "Microphone" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Speaker" }))
      .not.toBeInTheDocument();

    await act(async () => {
      deviceChangeListeners.forEach((listener) =>
        listener(new Event("devicechange"))
      );
    });

    expect(await screen.findByRole("combobox", { name: "Microphone" }))
      .toHaveTextContent("USB microphone");
    expect(screen.getByRole("combobox", { name: "Speaker" }))
      .toHaveTextContent("USB headset");
    expect(refreshDevicesMock).toHaveBeenCalledOnce();
  });

  it("hands the booked lesson to the booking-aware call action in the join window", async () => {
    renderScreen("2026-07-21T10:20:00.000Z");
    const join = await screen.findByRole("button", { name: "Join lesson" });
    fireEvent.click(join);
    expect(startLessonCallMock).toHaveBeenCalledWith(
      lesson.id,
      "coach-1",
      "Patricia"
    );
  });

  it("keeps local checks useful when the LiveKit diagnostic is unavailable", async () => {
    const checkMedia = vi.fn(async () => ({
      ok: false as const,
      code: "media_unavailable",
      notice: "We couldn’t check the call connection right now. Your camera and microphone check still works.",
    }));
    renderScreen("2026-07-21T08:00:00.000Z", commands(checkMedia));

    expect(await screen.findByText("Connection check needs another try"))
      .toBeInTheDocument();
    expect(screen.getByText(/camera and microphone check still works/i))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });

  it("explains how to recover when browser media permission is blocked", async () => {
    sessionStartMock.mockRejectedValueOnce(new Error("blocked"));
    renderScreen("2026-07-21T08:00:00.000Z");

    expect(await screen.findByText(/Allow access in your browser settings/i))
      .toBeInTheDocument();
    expect(checkConnectionMock).not.toHaveBeenCalled();
  });

  it("stops camera and microphone tracks when the setup surface closes", async () => {
    const view = renderScreen("2026-07-21T08:00:00.000Z");
    await waitFor(() => expect(sessionStartMock).toHaveBeenCalledOnce());
    view.unmount();
    expect(sessionStopMock).toHaveBeenCalled();
  });

  it("shows a calm finished state without requesting device access", () => {
    renderScreen("2026-07-21T11:20:00.000Z");

    expect(screen.getByRole("heading", { name: "This lesson has ended" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" }))
      .toHaveAttribute("href", "/home");
    expect(sessionStartMock).not.toHaveBeenCalled();
  });
});
