import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VoicePlayer } from "./voice-player";

const meta = {
  title: "Chat/VoicePlayer",
  component: VoicePlayer,
  tags: ["autodocs"],
  args: {
    duration: "0:18",
    progress: 30,
  },
  argTypes: {
    progress: {
      control: {
        type: "range",
        min: 0,
        max: 100,
        step: 1,
      },
    },
  },
} satisfies Meta<typeof VoicePlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const AlmostDone: Story = {
  args: {
    duration: "0:42",
    progress: 82,
  },
};
