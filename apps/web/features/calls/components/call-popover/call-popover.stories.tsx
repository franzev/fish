import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CallSessionState } from "@fish/core/call-state";
import { fn, userEvent, within } from "storybook/test";
import { CallPopoverView } from "../call-popover-view";

const activeCall: CallSessionState = {
  callId: "call-1",
  counterpartId: "gwyn",
  counterpartName: "Gwyn",
  kind: "audio",
  status: "active",
  direction: "outgoing",
  muted: false,
  cameraEnabled: false,
  expiresAt: null,
  connectedAt: "2026-07-14T08:30:00.000Z",
  failureReason: null,
};

const meta = {
  title: "Calls/CallPopover",
  component: CallPopoverView,
  parameters: { layout: "fullscreen" },
  args: {
    call: activeCall,
    openChat: fn(async () => undefined),
    notice: null,
    busy: false,
    audioBlocked: false,
    localMicrophoneActive: true,
    localMicrophoneLevel: 0.56,
    remoteSpeaking: false,
    remoteMicrophoneLevel: 0,
    remoteMuted: false,
    localVideoStream: null,
    remoteVideoTrack: null,
    videoQualityPreference: "auto",
    answer: fn(async () => undefined),
    decline: fn(async () => undefined),
    cancel: fn(async () => undefined),
    end: fn(async () => undefined),
    toggleMute: fn(async () => undefined),
    toggleCamera: fn(async () => undefined),
    hearCall: fn(async () => undefined),
    microphones: fn(async () => [
      { deviceId: "default", label: "Built-in microphone" },
      { deviceId: "usb", label: "USB headset microphone" },
    ]),
    switchMicrophone: fn(async () => undefined),
    setVideoQualityPreference: fn(),
  },
} satisfies Meta<typeof CallPopoverView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveAudio: Story = {};
export const ActiveMuted: Story = { args: { call: { ...activeCall, muted: true }, localMicrophoneActive: false } };
export const RemoteSpeaking: Story = { args: { remoteSpeaking: true, remoteMicrophoneLevel: 0.68 } };
export const RemoteMuted: Story = { args: { remoteMuted: true } };
export const ActiveVideo: Story = { args: { call: { ...activeCall, kind: "video", cameraEnabled: true }, presentation: "screen" } };
export const IncomingVideo: Story = { args: { call: { ...activeCall, kind: "video", status: "ringing", direction: "incoming" } } };
export const IncomingLongName: Story = { args: { call: { ...activeCall, counterpartName: "Alexandria Montgomery-Santos", kind: "video", status: "ringing", direction: "incoming" } } };
export const OutgoingRinging: Story = { args: { call: { ...activeCall, status: "ringing", direction: "outgoing" } } };
export const RequestingPermission: Story = { args: { call: { ...activeCall, status: "requestingPermission" } } };
export const Connecting: Story = { args: { call: { ...activeCall, status: "connecting" } } };
export const Reconnecting: Story = { args: { call: { ...activeCall, status: "reconnecting" } } };
export const AudioBlocked: Story = { args: { audioBlocked: true } };
export const Notice: Story = { args: { notice: "Your microphone changed. The call is still connected." } };
export const BusyIncoming: Story = { args: { busy: true, call: { ...activeCall, status: "ringing", direction: "incoming" } } };
export const AnsweringIncoming: Story = {
  args: {
    answer: fn(() => new Promise<void>(() => undefined)),
    call: { ...activeCall, kind: "video", status: "ringing", direction: "incoming" },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Answer" }));
  },
};
export const DecliningIncoming: Story = {
  args: {
    decline: fn(() => new Promise<void>(() => undefined)),
    call: { ...activeCall, kind: "video", status: "ringing", direction: "incoming" },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Decline" }));
  },
};
export const Failed: Story = { args: { call: { ...activeCall, status: "failed", failureReason: "connectFailed" } } };
export const Missed: Story = { args: { call: { ...activeCall, status: "missed", direction: "incoming" } } };
export const SettingsOpen: Story = {
  args: { call: { ...activeCall, kind: "video", cameraEnabled: true }, presentation: "screen" },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Call settings" }));
  },
};
