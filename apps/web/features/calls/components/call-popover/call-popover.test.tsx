import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createEmptyCallState } from "@fish/core/call-state";
import type { RemoteVideoTrack } from "livekit-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { deviceChangeListeners, navigation, pushMock, replaceMock, useCallMock } = vi.hoisted(() => ({
  deviceChangeListeners: new Set<EventListener>(),
  navigation: { pathname: "/home" },
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  useCallMock: vi.fn(),
}));

vi.mock("../call-provider", () => ({
  useCall: useCallMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

import { CallPopover } from "./call-popover";
import { CallScreen } from "../call-screen";

function callValue() {
  const state = createEmptyCallState();
  state.current = {
    ...state.current,
    callId: "call-1",
    counterpartId: "client-1",
    counterpartName: "Franz",
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
    remoteMicrophoneLevel: 0,
    remoteMuted: false,
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
    navigation.pathname = "/home";
    pushMock.mockReset();
    replaceMock.mockReset();
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
    value.remoteSpeaking = true;
    value.remoteMicrophoneLevel = 0.68;
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.getByRole("heading", { name: "In call with Franz" })).toBeVisible();
    const callActivity = screen.getByRole("group", { name: "Call activity" });
    expect(within(callActivity).getByText("Voice detected")).toBeVisible();
    expect(within(callActivity).getByText("Speaking")).toBeVisible();
    expect(within(callActivity).getByText("You")).toBeVisible();
    expect(within(callActivity).getByText("Franz")).toBeVisible();
    const remoteMicrophone = within(callActivity).getByRole("group", {
      name: "Franz microphone",
    });
    const remoteMeter = remoteMicrophone.querySelector(
      '[data-slot="microphone-volume-meter"]'
    );
    expect(remoteMeter).toBeInTheDocument();
    expect(remoteMeter?.firstElementChild).toHaveClass("bg-success");
    expect(screen.getByRole("button", { name: "Mute" })).toBeVisible();
    const openChatButton = screen.getByRole("button", { name: "Open chat" });
    expect(openChatButton).toBeVisible();
    const settingsButton = screen.getByRole("button", { name: "Call settings" });
    expect(settingsButton).toBeVisible();
    expect(settingsButton.className).toBe(openChatButton.className);
    expect(settingsButton.querySelector("svg")).toHaveAttribute("width", "20");
    expect(settingsButton.querySelector("svg")).toHaveAttribute("height", "20");
    expect(settingsButton.querySelector("svg")).toHaveAttribute("stroke-width", "1.75");
    expect(screen.getByRole("button", { name: "End call" })).toBeVisible();

    const panel = screen.getByRole("complementary");
    expect(panel).toHaveClass(
      "call-popover-width",
      "bottom-mobile-nav-offset",
      "left-page",
      "sm:bottom-page"
    );
    expect(panel).not.toHaveClass("right-page", "w-auto", "sm:w-full");
  });

  it("shows a caller-first incoming prompt with one dominant answer action", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.status = "ringing";
    value.state.current.direction = "incoming";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.getByRole("heading", { name: "Franz is calling" })).toHaveClass(
      "font-serif",
      "text-heading-sm"
    );
    expect(screen.getByText("Video call. Answer when you’re ready.")).toHaveClass("text-ui-sm");

    const answer = screen.getByRole("button", { name: "Answer" });
    const decline = screen.getByRole("button", { name: "Decline" });
    expect(screen.getAllByRole("button")).toEqual([decline, answer]);
    expect(answer).toHaveClass(
      "min-h-control-primary",
      "rounded-control",
      "bg-success",
      "text-on-primary",
      "font-semibold",
      "hover:bg-success-press"
    );
    expect(decline).toHaveClass(
      "min-h-control-primary",
      "rounded-control",
      "border-error",
      "text-error",
      "bg-surface-2"
    );
    expect(decline).not.toHaveClass("bg-error", "font-semibold");
    expect(answer).not.toHaveClass("rounded-pill");
    expect(decline).not.toHaveClass("rounded-pill");
    expect(screen.queryByLabelText("Franz video")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Your video preview")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(answer);
    });
    expect(value.answer).toHaveBeenCalledOnce();
    expect(value.decline).not.toHaveBeenCalled();
  });

  it("uses the audio call copy and phone icon for an incoming audio call", () => {
    const value = callValue();
    value.state.current.kind = "audio";
    value.state.current.status = "ringing";
    value.state.current.direction = "incoming";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.getByRole("heading", { name: "Franz is calling" })).toBeVisible();
    expect(screen.getByText("Audio call. Answer when you’re ready.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Answer" }).querySelector("svg")).toBeInTheDocument();
  });

  it("shows a compact caller-first outgoing video prompt with a quiet cancel action", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.status = "ringing";
    value.state.current.direction = "outgoing";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.getByRole("heading", { name: "Calling Franz" })).toHaveClass(
      "break-words",
      "font-serif",
      "text-heading-sm"
    );
    expect(screen.getByText("Video call. They’ll join when they’re ready.")).toHaveClass("text-ui-sm");
    const cancelCall = screen.getByRole("button", { name: "Cancel" });
    expect(cancelCall).toHaveClass(
      "min-h-control-primary",
      "rounded-control",
      "border-error",
      "text-error",
      "bg-surface-2"
    );
    expect(cancelCall).not.toHaveClass("w-full", "bg-error", "font-semibold", "rounded-pill");
    expect(cancelCall.parentElement).toHaveClass("flex", "justify-start");
    expect(cancelCall.querySelector("svg")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toEqual([cancelCall]);

    await act(async () => {
      fireEvent.click(cancelCall);
    });
    expect(value.cancel).toHaveBeenCalledOnce();
  });

  it("identifies an outgoing audio call without adding a decorative call badge", () => {
    const value = callValue();
    value.state.current.kind = "audio";
    value.state.current.status = "ringing";
    value.state.current.direction = "outgoing";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.getByRole("heading", { name: "Calling Franz" })).toBeVisible();
    expect(screen.getByText("Audio call. They’ll join when they’re ready.")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("shows stable progress on Cancel while cancellation is pending", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.status = "ringing";
    value.state.current.direction = "outgoing";
    let finishCancel: (() => void) | undefined;
    value.cancel = vi.fn(() => new Promise<undefined>((resolve) => {
      finishCancel = () => resolve(undefined);
    }));
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    const cancelCall = screen.getByRole("button", { name: "Cancel" });
    await act(async () => {
      fireEvent.click(cancelCall);
    });

    expect(cancelCall).toHaveAttribute("aria-busy", "true");
    expect(cancelCall).toBeDisabled();
    expect(cancelCall.querySelector(".animate-spin")).not.toBeNull();

    await act(async () => finishCancel?.());
    expect(cancelCall).not.toHaveAttribute("aria-busy");
    expect(cancelCall).toBeEnabled();
  });

  it("keeps long outgoing caller names readable without changing the action layout", () => {
    const value = callValue();
    value.state.current.counterpartName = "Alexandria Montgomery-Santos";
    value.state.current.kind = "video";
    value.state.current.status = "ringing";
    value.state.current.direction = "outgoing";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    const heading = screen.getByRole("heading", {
      name: "Calling Alexandria Montgomery-Santos",
    });
    expect(heading).toHaveClass("break-words");
    expect(heading).not.toHaveClass("truncate");
    expect(screen.getByRole("button", { name: "Cancel" }).parentElement).toHaveClass(
      "flex",
      "justify-start"
    );
  });

  it("disables outgoing cancellation while another call operation is busy", () => {
    const value = callValue();
    value.busy = true;
    value.state.current.status = "ringing";
    value.state.current.direction = "outgoing";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    const cancelCall = screen.getByRole("button", { name: "Cancel" });
    expect(cancelCall).toBeDisabled();
    expect(cancelCall).not.toHaveAttribute("aria-busy");
    expect(cancelCall.querySelector(".animate-spin")).toBeNull();
  });

  it("shows progress only on the incoming action that was activated", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.status = "ringing";
    value.state.current.direction = "incoming";
    let finishDecline: (() => void) | undefined;
    value.decline = vi.fn(() => new Promise<undefined>((resolve) => {
      finishDecline = () => resolve(undefined);
    }));
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    const answer = screen.getByRole("button", { name: "Answer" });
    const decline = screen.getByRole("button", { name: "Decline" });
    await act(async () => {
      fireEvent.click(decline);
    });

    expect(decline).toHaveAttribute("aria-busy", "true");
    expect(decline.querySelector(".animate-spin")).not.toBeNull();
    expect(answer).toBeDisabled();
    expect(answer).not.toHaveAttribute("aria-busy");

    await act(async () => finishDecline?.());
    expect(decline).not.toHaveAttribute("aria-busy");
    expect(answer).toBeEnabled();
  });

  it("shows progress only on Answer while an incoming answer is pending", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.status = "ringing";
    value.state.current.direction = "incoming";
    let finishAnswer: (() => void) | undefined;
    value.answer = vi.fn(() => new Promise<undefined>((resolve) => {
      finishAnswer = () => resolve(undefined);
    }));
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    const answer = screen.getByRole("button", { name: "Answer" });
    const decline = screen.getByRole("button", { name: "Decline" });
    await act(async () => {
      fireEvent.click(answer);
    });

    expect(answer).toHaveAttribute("aria-busy", "true");
    expect(answer.querySelector(".animate-spin")).not.toBeNull();
    expect(decline).toBeDisabled();
    expect(decline).not.toHaveAttribute("aria-busy");

    await act(async () => finishAnswer?.());
    expect(answer).not.toHaveAttribute("aria-busy");
    expect(decline).toBeEnabled();
  });

  it("shows when the other person is muted in audio and video calls", () => {
    const value = callValue();
    value.remoteMuted = true;
    useCallMock.mockReturnValue(value);

    const view = render(<CallPopover />);

    const remoteMicrophone = screen.getByRole("group", { name: "Franz microphone" });
    expect(remoteMicrophone).toHaveTextContent("FranzMuted");
    expect(remoteMicrophone.querySelector("svg")).toHaveClass("text-muted");

    value.state.current.kind = "video";
    view.rerender(<CallScreen callId="call-1" />);

    const videoMutedStatus = screen.getByText("Franz is muted").parentElement;
    expect(videoMutedStatus).toBeVisible();
    expect(videoMutedStatus).toHaveClass(
      "inset-x-sm",
      "bottom-sm",
      "z-10",
      "mx-auto",
      "w-fit"
    );
    expect(videoMutedStatus).not.toHaveClass("left-xs", "top-xs");
  });

  it("shows video surfaces and preserves the call quality controls", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.cameraEnabled = true;
    value.remoteSpeaking = true;
    value.remoteMicrophoneLevel = 0.68;
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);

    expect(screen.getByLabelText("Franz video")).toBeVisible();
    expect(screen.getByLabelText("Your video preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Your video preview")).toHaveClass("object-contain");
    expect(screen.getByLabelText("Franz video")).toHaveClass("object-contain");
    const remoteSpeakingStatus = screen.getByRole("status", {
      name: "Franz is speaking",
    });
    expect(
      remoteSpeakingStatus.querySelector(
        '[data-slot="microphone-volume-meter"]'
      )
    ).toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: "In call with Franz" });
    expect(heading.parentElement?.parentElement).toHaveClass("sr-only");
    expect(screen.getByTestId("microphone-on-icon")).toBeInTheDocument();
    expect(screen.getByTestId("camera-on-icon")).toBeInTheDocument();
    const muteButton = screen.getByRole("button", { name: "Mute" });
    const meter = muteButton.parentElement?.querySelector(
      '[data-slot="microphone-volume-meter"]'
    );
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

  it("lets people move their video preview with the keyboard", () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.cameraEnabled = true;
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);

    const preview = screen.getByRole("group", {
      name: "Your movable video preview",
    });
    const resizeHandle = screen.getByRole("button", {
      name: "Resize your video preview",
    });
    expect(preview).toHaveClass("rounded-none");
    expect(preview).toHaveClass("border-0");
    expect(preview).not.toHaveClass("shadow-none");
    expect(resizeHandle).toHaveClass("sr-only");
    const stage = preview.parentElement as HTMLDivElement;
    Object.defineProperties(stage, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 },
    });
    Object.defineProperties(preview, {
      offsetWidth: { configurable: true, value: 200 },
      offsetHeight: { configurable: true, value: 112 },
    });
    stage.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, toJSON: () => ({}),
    });
    preview.getBoundingClientRect = () => ({
      x: 584, y: 472, left: 584, top: 472, right: 784, bottom: 584,
      width: 200, height: 112, toJSON: () => ({}),
    });

    expect(preview).toHaveAccessibleDescription(
      "Drag the center to move. Drag an edge or corner to resize. Use arrow keys when focused."
    );
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 585,
      clientY: 473,
    });
    expect(preview).toHaveClass("cursor-nwse-resize");
    fireEvent.keyDown(preview, { key: "ArrowLeft" });

    expect(preview).toHaveStyle({
      transform: "translate3d(568px, 472px, 0)",
    });
  });

  it("lets people resize their video preview with the keyboard", () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.cameraEnabled = true;
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);

    const preview = screen.getByRole("group", {
      name: "Your movable video preview",
    });
    const stage = preview.parentElement as HTMLDivElement;
    Object.defineProperties(stage, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 },
    });
    Object.defineProperties(preview, {
      offsetWidth: { configurable: true, value: 200 },
      offsetHeight: { configurable: true, value: 112.5 },
    });
    stage.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, toJSON: () => ({}),
    });
    preview.getBoundingClientRect = () => ({
      x: 584, y: 471.5, left: 584, top: 471.5, right: 784, bottom: 584,
      width: 200, height: 112.5, toJSON: () => ({}),
    });

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Resize your video preview" }),
      { key: "ArrowUp" }
    );

    expect(preview).toHaveStyle({
      width: "216px",
      height: "121.5px",
      transform: "translate3d(568px, 462.5px, 0)",
    });
  });

  it("resizes the video preview when its edge is dragged", () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.state.current.cameraEnabled = true;
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);

    const preview = screen.getByRole("group", {
      name: "Your movable video preview",
    });
    const stage = preview.parentElement as HTMLDivElement;
    Object.defineProperties(stage, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 },
    });
    Object.defineProperties(preview, {
      offsetWidth: { configurable: true, value: 200 },
      offsetHeight: { configurable: true, value: 112.5 },
      setPointerCapture: { configurable: true, value: vi.fn() },
    });
    stage.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, toJSON: () => ({}),
    });
    preview.getBoundingClientRect = () => ({
      x: 584, y: 471.5, left: 584, top: 471.5, right: 784, bottom: 584,
      width: 200, height: 112.5, toJSON: () => ({}),
    });

    fireEvent.pointerDown(preview, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 783,
      clientY: 528,
    });
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 799,
      clientY: 528,
    });

    expect(preview).toHaveStyle({
      width: "216px",
      height: "121.5px",
      transform: "translate3d(584px, 471.5px, 0)",
    });
  });

  it("leaves the dedicated video call route to CallScreen", () => {
    const value = callValue();
    value.state.current.kind = "video";
    navigation.pathname = "/calls/call-1";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("routes an accepted video call away from the alert popover", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    useCallMock.mockReturnValue(value);

    render(<CallPopover />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/calls/call-1");
    });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Franz video")).not.toBeInTheDocument();
  });

  it("does not redirect chat away from the dedicated video call route", () => {
    const value = callValue();
    value.state.current.kind = "video";
    navigation.pathname = "/calls/call-1";
    useCallMock.mockReturnValue(value);
    const loadChatPreviewsAction = vi.fn();

    render(<CallPopover loadChatPreviewsAction={loadChatPreviewsAction} />);

    expect(loadChatPreviewsAction).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringMatching(/^\/messages/));
  });

  it("refreshes available microphones when a device is connected", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.microphones
      .mockResolvedValueOnce([
        { deviceId: "default", label: "Built-in microphone" },
      ])
      .mockResolvedValueOnce([
        { deviceId: "default", label: "Built-in microphone" },
        { deviceId: "usb", label: "USB microphone" },
      ]);
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);
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

    const view = render(<CallScreen callId="call-1" />);
    const video = screen.getByLabelText("Franz video");
    expect(attach).toHaveBeenCalledWith(video);

    view.unmount();
    expect(detach).toHaveBeenCalledWith(video);
  });

  it("uses the remembered data saver preference", async () => {
    const value = callValue();
    value.state.current.kind = "video";
    value.videoQualityPreference = "data-saver";
    useCallMock.mockReturnValue(value);

    render(<CallScreen callId="call-1" />);
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
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });
});
