import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bubble } from "./bubble";

const meta = {
  title: "Chat/Bubble",
  component: Bubble,
  tags: ["autodocs"],
  args: {
    mine: false,
    children: "Try it once more, a little slower on the middle word.",
  },
} satisfies Meta<typeof Bubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Received: Story = {};

export const Mine: Story = {
  args: {
    mine: true,
    children: "I can present the update in the meeting.",
  },
};

export const LongCopy: Story = {
  args: {
    children:
      "When a sentence feels crowded, pause after the subject and let the rest land in one calm breath.",
  },
};
