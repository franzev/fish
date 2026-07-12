import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createEmptyCallState } from "@fish/core/call-state";
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
    remoteVideoStream: null,
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

  it("shows video surfaces and camera controls only for a video call", () => {
    const value = activeCallValue();
    value.state.current.kind = "video";
    value.state.current.cameraEnabled = true;
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);

    expect(
      screen.getByRole("heading", { name: "Video call with Alex" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Alex video")).toBeInTheDocument();
    expect(screen.getByLabelText("Your video preview")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Turn camera off" })
    ).toBeInTheDocument();
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
