import { fireEvent, render, screen } from "@testing-library/react";
import { createEmptyCallState } from "@fish/core/call-state";
import type { RemoteVideoTrack } from "livekit-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useCallMock } = vi.hoisted(() => ({
  useCallMock: vi.fn(),
}));

vi.mock("../call-provider", () => ({
  useCall: useCallMock,
}));

import { CallScreen } from "./call-screen";

function activeVideoCallValue() {
  const state = createEmptyCallState();
  state.current = {
    ...state.current,
    callId: "call-1",
    counterpartId: "coach-1",
    counterpartName: "Gwyn",
    direction: "outgoing",
    kind: "video",
    status: "active",
  };

  return {
    state,
    notice: null,
    busy: false,
    audioBlocked: false,
    localMicrophoneActive: true,
    localMicrophoneLevel: 0.42,
    remoteSpeaking: false,
    remoteMicrophoneLevel: 0,
    remoteMuted: false,
    localVideoStream: null,
    remoteVideoTrack: null as RemoteVideoTrack | null,
    videoQualityPreference: "auto" as const,
    answer: vi.fn(async () => undefined),
    decline: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
    toggleMute: vi.fn(async () => undefined),
    toggleCamera: vi.fn(async () => undefined),
    hearCall: vi.fn(async () => undefined),
    clear: vi.fn(),
    microphones: vi.fn(async () => []),
    switchMicrophone: vi.fn(async () => undefined),
    setVideoQualityPreference: vi.fn(),
  };
}

describe("CallScreen", () => {
  beforeEach(() => {
    useCallMock.mockReset();
  });

  it("toggles the existing conversation in place with the messages icon", () => {
    useCallMock.mockReturnValue(activeVideoCallValue());

    render(
      <CallScreen
        callId="call-1"
        chatSidebar={<div>Persistent conversation</div>}
      />
    );

    const toggle = screen.getByRole("button", { name: "Open chat" });
    const sidebar = screen.getByRole("complementary", {
      name: "Messages with Gwyn",
    });

    expect(toggle).toHaveAttribute("aria-controls", "call-messages");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.querySelector("svg")).toHaveClass("tabler-icon-messages");
    expect(sidebar).toHaveClass("hidden");

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Close chat" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(sidebar).toHaveClass("flex");
    expect(screen.getByText("Persistent conversation")).toBeInTheDocument();
  });

  it("does not render a different active call on this route", () => {
    const value = activeVideoCallValue();
    value.state.current.callId = "call-2";
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" chatSidebar={<div>Wrong chat</div>} />);

    expect(screen.queryByText("Wrong chat")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
