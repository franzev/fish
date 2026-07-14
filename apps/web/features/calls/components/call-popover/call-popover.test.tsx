import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createEmptyCallState } from "@fish/core/call-state";
import type { RemoteVideoTrack } from "livekit-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { deviceChangeListeners, useCallMock } = vi.hoisted(() => ({
  deviceChangeListeners: new Set<EventListener>(),
  useCallMock: vi.fn(),
}));

vi.mock("../call-provider", () => ({
  useCall: useCallMock,
}));

import { CallPopover } from "./call-popover";

function callValue() {
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
    notice: null,
    busy: false,
    audioBlocked: false,
    localMicrophoneActive: true,
    localMicrophoneLevel: 0.42,
    remoteSpeaking: false,
    localVideoStream: null,
    remoteVideoTrack: null as RemoteVideoTrack | null,
    videoQualityPreference: "auto" as "auto" | "data-saver",
    answer: vi.fn(async () => undefined),
    decline: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
    toggleMute: vi.fn(async () => undefined),
    toggleCamera: vi.fn(async () => undefined),
    hearCall: vi.fn(async () => undefined),
    clear: vi.fn(),
    microphones: vi.fn(async () => [
      { deviceId: "default", label: "Built-in microphone" },
      { deviceId: "usb", label: "USB microphone" },
    ]),
    switchMicrophone: vi.fn(async () => undefined),
    setVideoQualityPreference: vi.fn(),
  };
}

describe("CallPopover", () => {
  beforeEach(() => {
    deviceChangeListeners.clear();
    useCallMock.mockReset();
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays hidden when there is no current call", () => {
    const value = callValue();
    value.state = createEmptyCallState();
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByText(/call/i)).not.toBeInTheDocument();
  });

  it("shows a compact audio call with speaking state and accessible controls", () => {
    const value = callValue();
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.getByRole("heading", { name: "In call with Alex" })).toBeVisible();
    expect(screen.getByText("Voice detected")).toBeVisible();
    expect(screen.getByText("Listening")).toBeVisible();
    expect(screen.getByRole("button", { name: "Mute" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Call settings" })).toBeVisible();
    expect(screen.getByRole("button", { name: "End call" })).toBeVisible();

    const panel = screen.getByRole("complementary");
    expect(panel).toHaveClass(
      "bottom-mobile-nav-offset",
      "left-page",
      "right-page",
      "md:bottom-page",
      "md:w-full",
      "md:max-w-call-popover"
    );
  });

  it("keeps the incoming answer as the only primary action", () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.status = "ringing";
    value.state.current.direction = "incoming";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    const answer = screen.getByRole("button", { name: "Answer video call" });
    const decline = screen.getByRole("button", { name: "Not now" });
    expect(answer).toHaveClass("min-h-control-primary", "bg-primary");
    expect(decline).not.toHaveClass("bg-primary");

    fireEvent.click(answer);
    fireEvent.click(decline);
    expect(value.answer).toHaveBeenCalledOnce();
    expect(value.decline).toHaveBeenCalledOnce();
  });

  it("shows video surfaces and preserves the call quality controls", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.cameraEnabled = true;
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.getByLabelText("Alex video")).toBeVisible();
    expect(screen.getByLabelText("Your video preview")).toBeInTheDocument();
    expect(screen.getByTestId("microphone-on-icon")).toBeInTheDocument();
    expect(screen.getByTestId("camera-on-icon")).toBeInTheDocument();
    const muteButton = screen.getByRole("button", { name: "Mute" });
    const meter = document.querySelector('[data-slot="microphone-volume-meter"]');
    expect(meter).toBeInTheDocument();
    expect(meter?.firstElementChild).toHaveClass("bg-success");
    expect(muteButton.parentElement).toContainElement(meter as HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: "Call settings" }));
    const microphone = await screen.findByRole("combobox", { name: "Microphone" });
    fireEvent.change(microphone, { target: { value: "usb" } });

    await waitFor(() => {
      expect(value.switchMicrophone).toHaveBeenCalledWith("usb");
    });
    const dataSaver = screen.getByRole("switch", { name: "Use less data" });
    expect(dataSaver).toHaveAttribute("aria-checked", "false");
    expect(dataSaver).toHaveAccessibleDescription(
      "Lowers video quality to help on slower connections."
    );

    fireEvent.click(dataSaver);
    expect(value.setVideoQualityPreference).toHaveBeenCalledWith("data-saver");
  });

  it("refreshes available microphones when a device is connected", async () => {
    const value = callValue();
    value.microphones
      .mockResolvedValueOnce([
        { deviceId: "default", label: "Built-in microphone" },
      ])
      .mockResolvedValueOnce([
        { deviceId: "default", label: "Built-in microphone" },
        { deviceId: "usb", label: "USB microphone" },
      ]);
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);
    fireEvent.click(screen.getByRole("button", { name: "Call settings" }));

    const microphone = await screen.findByRole("combobox", {
      name: "Microphone",
    });
    expect(microphone).not.toHaveTextContent("USB microphone");

    await act(async () => {
      deviceChangeListeners.forEach((listener) =>
        listener(new Event("devicechange"))
      );
    });

    await waitFor(() => {
      expect(microphone).toHaveTextContent("USB microphone");
    });
    expect(value.microphones).toHaveBeenCalledTimes(2);
  });

  it("attaches and detaches the remote LiveKit track", () => {
    const value = callValue();
    const attach = vi.fn();
    const detach = vi.fn();
    value.state.current.kind = "video";
    value.remoteVideoTrack = { attach, detach } as unknown as RemoteVideoTrack;
    useCallMock.mockReturnValue(value);

    const view = render(<CallPopover />);
    const video = screen.getByLabelText("Alex video");
    expect(attach).toHaveBeenCalledWith(video);

    view.unmount();
    expect(detach).toHaveBeenCalledWith(video);
  });

  it("uses the remembered data saver preference", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.videoQualityPreference = "data-saver";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);
    fireEvent.click(screen.getByRole("button", { name: "Call settings" }));

    expect(await screen.findByRole("switch", { name: "Use less data" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("clears terminal feedback automatically without a dismiss choice", () => {
    vi.useFakeTimers();
    const value = callValue();
    value.state.current.status = "ended";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.getByRole("heading", { name: "Call ended" })).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4_999));
    expect(value.clear).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(value.clear).toHaveBeenCalledOnce();
  });

  it("truncates long participant names without changing the control layout", () => {
    const value = callValue();
    value.state.current.counterpartName = "Alexandria Very Long Name With Emoji 🐟 العربية";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.getByRole("heading")).toHaveClass("truncate");
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
