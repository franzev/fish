import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { LessonSetupView } from "./lesson-setup-view";

const meta = {
  title: "Booking/LessonSetupView",
  component: LessonSetupView,
  parameters: { layout: "fullscreen" },
  args: {
    coach: { id: "coach-1", displayName: "Coach Patricia", avatarUrl: null },
    lesson: {
      id: "11111111-1111-4111-8111-111111111111",
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
    microphoneLevel: 0.6,
    notice: null,
    callNotice: null,
    speakerNotice: null,
    busy: false,
    speakerSelectionSupported: false,
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

export const Default: Story = {};
