import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { CallPopoverView } from "./call-popover-view";

const meta = {
  title: "Calls/CallPopoverView",
  component: CallPopoverView,
  parameters: { layout: "fullscreen" },
  args: {
    call: {
      callId: "call-1",
      counterpartId: "coach-dana",
      counterpartName: "Coach Dana",
      kind: "audio",
      status: "active",
      direction: "outgoing",
      muted: false,
      cameraEnabled: false,
      expiresAt: null,
      connectedAt: "2026-07-14T08:30:00.000Z",
      failureReason: null,
    },
    notice: null,
    busy: false,
    audioBlocked: false,
    localMicrophoneActive: true,
    localMicrophoneLevel: 0.56,
    remoteSpeaking: false,
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
    microphones: fn(async () => []),
    switchMicrophone: fn(async () => undefined),
    setVideoQualityPreference: fn(),
  },
} satisfies Meta<typeof CallPopoverView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
