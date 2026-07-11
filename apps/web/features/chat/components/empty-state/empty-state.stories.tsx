import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "./empty-state";

const meta = {
  title: "Chat/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    title: "No messages yet",
    description: "Say hello to get things started.",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AssignedConversation: Story = {
  args: {
    title: "Your coach is ready",
    description: "Send your first practice sentence when you are ready.",
  },
};
