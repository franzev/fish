import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LessonSetupViewProps } from "./lesson-setup-view";
import { LessonSetupView } from "./lesson-setup-view";

const props: LessonSetupViewProps = {
  coach: { id: "coach-1", displayName: "Coach Patricia", avatarUrl: null },
  lesson: {
    id: "lesson-1",
    coachId: "coach-1",
    startsAt: "2026-07-21T10:30:00.000Z",
    endsAt: "2026-07-21T11:20:00.000Z",
    durationMinutes: 50,
    bookedByClientId: "client-1",
    bookedAt: "2026-07-14T00:00:00.000Z",
  },
  locale: "en-US",
  timeZone: "Asia/Manila",
  timeFormatPref: "24h",
  ended: false,
  joinable: true,
  mediaStatus: "ready",
  connectionStatus: "ready",
  stream: null,
  microphoneAvailable: true,
  cameraAvailable: true,
  devices: [],
  microphoneId: "",
  cameraId: "",
  speakerId: "",
  microphoneEnabled: true,
  cameraEnabled: true,
  microphoneLevel: 0.1,
  notice: null,
  callNotice: null,
  speakerNotice: null,
  busy: false,
  speakerSelectionSupported: false,
  onToggleMicrophone: vi.fn(),
  onToggleCamera: vi.fn(),
  onSwitchInput: vi.fn(),
  onSpeakerChange: vi.fn(),
  onPlayTestSound: vi.fn(),
  onRetryConnection: vi.fn(),
  onJoin: vi.fn(),
};

const originalMatchMedia = window.matchMedia;

describe("LessonSetupView", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("announces discrete readiness without announcing microphone levels", () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const { rerender } = render(<LessonSetupView {...props} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Camera is ready. Microphone is ready. Connection is ready."
    );

    rerender(<LessonSetupView {...props} microphoneLevel={0.8} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Camera is ready. Microphone is ready. Connection is ready."
    );
    expect(screen.getByText("We can hear you")).toBeVisible();
  });
});
