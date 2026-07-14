import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MicrophoneVolumeMeter } from "./microphone-volume-meter";

const meta = {
  title: "UI/Microphone volume meter",
  component: MicrophoneVolumeMeter,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { level: 0.6 },
} satisfies Meta<typeof MicrophoneVolumeMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};
export const Silent: Story = { args: { level: 0 } };
export const BelowThreshold: Story = { args: { level: 0.1 } };
export const LowActive: Story = { args: { level: 0.2, active: true } };
export const Maximum: Story = { args: { level: 1 } };
export const ClampedBelowZero: Story = { args: { level: -1 } };
export const ClampedAboveOne: Story = { args: { level: 2 } };
