import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { LessonSlot } from "@/lib/services";
import { fn, userEvent, within } from "storybook/test";
import { LessonSetupView } from "../lesson-setup-view";

const lesson: LessonSlot = {
  id: "11111111-1111-4111-8111-111111111111",
  coachId: "coach-1",
  startsAt: "2026-07-21T10:30:00.000Z",
  endsAt: "2026-07-21T11:20:00.000Z",
  durationMinutes: 50,
  bookedByClientId: "client-1",
  bookedAt: "2026-07-14T00:00:00.000Z",
};

const devices = [
  { deviceId: "built-in-mic", kind: "audioinput" as const, label: "Built-in microphone" },
  { deviceId: "usb-mic", kind: "audioinput" as const, label: "USB headset microphone" },
  { deviceId: "built-in-camera", kind: "videoinput" as const, label: "Built-in camera" },
  { deviceId: "desk-camera", kind: "videoinput" as const, label: "Desk camera" },
  { deviceId: "default", kind: "audiooutput" as const, label: "Built-in speakers" },
  { deviceId: "headset", kind: "audiooutput" as const, label: "USB headset" },
];

const meta = {
  title: "Booking/LessonSetupScreen",
  component: LessonSetupView,
  parameters: { layout: "fullscreen" },
  args: {
    coach: { id: "coach-1", displayName: "Coach Patricia", avatarUrl: null },
    lesson,
    locale: "en-US",
    timeZone: "Asia/Manila",
    timeFormatPref: "24h",
    ended: false,
    joinable: false,
    mediaStatus: "ready",
    connectionStatus: "ready",
    stream: null,
    microphoneAvailable: true,
    cameraAvailable: true,
    devices,
    microphoneId: "built-in-mic",
    cameraId: "built-in-camera",
    speakerId: "default",
    microphoneEnabled: true,
    cameraEnabled: true,
    microphoneLevel: 0.62,
    notice: null,
    callNotice: null,
    speakerNotice: null,
    busy: false,
    speakerSelectionSupported: true,
    onToggleMicrophone: fn(),
    onToggleCamera: fn(),
    onSwitchInput: fn(),
    onSpeakerChange: fn(),
    onPlayTestSound: fn(),
    onRetryConnection: fn(),
    onJoin: fn(),
  },
} satisfies Meta<typeof LessonSetupView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrivateCheckReady: Story = {};
export const Joinable: Story = { args: { joinable: true } };
export const Joining: Story = { args: { joinable: true, busy: true } };
export const StartingDevices: Story = {
  args: { mediaStatus: "starting", connectionStatus: "waiting", stream: null, microphoneAvailable: false, cameraAvailable: false, microphoneEnabled: false, cameraEnabled: false, microphoneLevel: 0 },
};
export const PermissionDenied: Story = {
  args: {
    mediaStatus: "denied",
    connectionStatus: "unavailable",
    stream: null,
    microphoneAvailable: false,
    cameraAvailable: false,
    microphoneEnabled: false,
    cameraEnabled: false,
    microphoneLevel: 0,
    notice: "Camera and microphone access is off. Allow access in your browser settings, then reload this page.",
  },
};
export const ConnectionRetry: Story = {
  args: { connectionStatus: "unavailable", notice: "The connection check needs another try." },
};
export const CameraAndMicrophoneOff: Story = {
  args: { microphoneEnabled: false, cameraEnabled: false, microphoneLevel: 0 },
};
export const CallNotice: Story = { args: { callNotice: "The lesson is still preparing. Your setup is saved." } };
export const DeviceSettings: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText("Device settings"));
  },
};
export const SpeakerTestComplete: Story = {
  args: { speakerNotice: "Test sound played." },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText("Device settings"));
  },
};
export const Ended: Story = { args: { ended: true } };
export const MissingLesson: Story = { args: { coach: null, lesson: null } };
export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
