import { IconHomeHeart, IconSparkles } from "@tabler/icons-react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "./empty-state";

const meta = {
  title: "Product/HomeEmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    Icon: IconHomeHeart,
    children: "Your coach will add your next step here.",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WaitingForCoach: Story = {};

export const GentlePrompt: Story = {
  args: {
    Icon: IconSparkles,
    children: "You are set for today. Come back when your coach adds more.",
  },
};
