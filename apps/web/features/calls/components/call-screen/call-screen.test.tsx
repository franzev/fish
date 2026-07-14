import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createEmptyCallState } from "@fish/core/call-state";
import type { RemoteVideoTrack } from "livekit-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, useCallMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  useCallMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("../call-provider", () => ({
  useCall: useCallMock,
}));

import { CallScreen } from "./call-screen";

function activeCallValue() {
  const state = createEmptyCallState();
  state.current = {
    ...state.current,
    callId: "call-1",
    counterpartId: "client-1",
    counterpartName: "Alex",
    direction: "outgoing",
    status: "active",
  };
  return {
    state,
    homeHref: "/coach",
    notice: null,
    busy: false,
    audioBlocked: false,
    localMicrophoneActive: true,
    remoteSpeaking: false,
    localVideoStream: null,
    remoteVideoTrack: null as RemoteVideoTrack | null,
    answer: vi.fn(async () => undefined),
    decline: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
    toggleMute: vi.fn(async () => undefined),
    toggleCamera: vi.fn(async () => undefined),
    hearCall: vi.fn(async () => undefined),
    loadCall: vi.fn(async () => undefined),
    leaveSurface: vi.fn(),
    clear: vi.fn(),
    microphones: vi.fn(async () => [
      { deviceId: "default", label: "Built-in microphone" },
      { deviceId: "usb", label: "USB microphone" },
    ]),
    switchMicrophone: vi.fn(async () => undefined),
  };
}

describe("CallScreen", () => {
  beforeEach(() => {
    pushMock.mockReset();
    useCallMock.mockReset();
  });

  it("keeps the active call focused and discloses microphone selection", async () => {
    const value = activeCallValue();
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);

    expect(screen.getByRole("heading", { name: "In call with Alex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End call" })).toBeInTheDocument();
    expect(screen.getByText("Picking up your voice")).toBeInTheDocument();
    expect(screen.getByText("Listening")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Audio settings" }));
    const microphone = await screen.findByRole("combobox", { name: "Microphone" });
    fireEvent.change(microphone, { target: { value: "usb" } });

    await waitFor(() => {
      expect(value.switchMicrophone).toHaveBeenCalledWith("usb");
    });
  });

  it("shows when the other participant is speaking", () => {
    const value = activeCallValue();
    value.localMicrophoneActive = false;
    value.remoteSpeaking = true;
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);

    expect(screen.getByText("No voice detected")).toBeInTheDocument();
    expect(screen.getByText("Speaking")).toBeInTheDocument();
  });

  it("shows video surfaces, camera controls, and popover audio settings for a video call", async () => {
    const value = activeCallValue();
    value.state.current.kind = "video";
    value.state.current.cameraEnabled = true;
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);

    expect(
      screen.queryByRole("heading", { name: "Video call with Alex" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Your microphone is on.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Alex video")).toBeInTheDocument();
    expect(screen.getByLabelText("Your video preview")).toBeInTheDocument();
    const muteButton = screen.getByRole("button", { name: "Mute" });
    const cameraButton = screen.getByRole("button", {
      name: "Turn camera off",
    });
    expect(muteButton).not.toHaveTextContent("Mute");
    expect(cameraButton).not.toHaveTextContent("Turn camera off");
    expect(muteButton).toHaveClass("min-w-control", "px-0");
    expect(cameraButton).toHaveClass("min-w-control", "px-0");
    expect(screen.getByRole("button", { name: "End call" })).toHaveClass(
      "min-h-control",
      "min-w-control",
      "rounded-control"
    );

    fireEvent.click(screen.getByRole("button", { name: "Audio settings" }));

    expect(
      await screen.findByRole("combobox", { name: "Microphone" })
    ).toBeInTheDocument();
    expect(value.microphones).toHaveBeenCalledOnce();
  });

  it("toggles chat in the video call sidebar", () => {
    const value = activeCallValue();
    value.state.current.kind = "video";
    useCallMock.mockReturnValue(value);

    render(
      <CallScreen
        callId="call-1"
        chatSidebar={<div>Persistent conversation</div>}
      />
    );

    expect(
      screen.getByRole("complementary", { name: "Messages with Alex" })
    ).toBeInTheDocument();
    expect(screen.getByText("Persistent conversation")).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Messages with Alex",
    });
    expect(sidebar).toHaveClass("hidden");

    const toggle = screen.getByRole("button", { name: "Open chat" });
    expect(toggle).toHaveAttribute("aria-controls", "call-messages");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).not.toHaveClass("lg:hidden");

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Close chat" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(sidebar).toHaveClass("flex");
  });

  it("does not expose a supplied chat surface during an audio call", () => {
    const value = activeCallValue();
    useCallMock.mockReturnValue(value);

    render(
      <CallScreen
        callId="call-1"
        chatSidebar={<div>Persistent conversation</div>}
      />
    );

    expect(screen.queryByText("Persistent conversation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open chat" })).toBeNull();
  });

  it("attaches remote video through LiveKit so adaptive quality tracks the stage", () => {
    const value = activeCallValue();
    const attach = vi.fn();
    const detach = vi.fn();
    const remoteVideoTrack = { attach, detach } as unknown as RemoteVideoTrack;
    value.state.current.kind = "video";
    value.remoteVideoTrack = remoteVideoTrack;
    useCallMock.mockReturnValue(value);

    const view = render(<CallScreen callId="call-1" />);
    const remoteVideo = screen.getByLabelText("Alex video");

    expect(attach).toHaveBeenCalledWith(remoteVideo);

    view.unmount();

    expect(detach).toHaveBeenCalledWith(remoteVideo);
  });

  it("makes video consent explicit when answering", () => {
    const value = activeCallValue();
    value.state.current.kind = "video";
    value.state.current.status = "ringing";
    value.state.current.direction = "incoming";
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);

    expect(
      screen.getByRole("button", { name: "Answer video call" })
    ).toBeInTheDocument();
  });

  it("returns a coach to the coach home after a terminal call", () => {
    const value = activeCallValue();
    value.state.current.status = "ended";
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Back to home" }));

    expect(value.clear).toHaveBeenCalledOnce();
    expect(pushMock).toHaveBeenCalledWith("/coach");
  });

  it("releases local media when the call surface unmounts", () => {
    const value = activeCallValue();
    useCallMock.mockReturnValue(value);

    const view = render(<CallScreen callId="call-1" />);
    view.unmount();

    expect(value.leaveSurface).toHaveBeenCalledOnce();
  });
});
