import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IconUsers } from "@tabler/icons-react";
import { Button } from "../button";
import { EmptyState } from "./empty-state";

const meta = {
  title: "UI/Empty state",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    title: "No messages yet",
    description: "Say hello to get things started.",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {};
export const Surface: Story = {
  args: {
    appearance: "surface",
    fill: false,
    icon: IconUsers,
    title: "No clients yet",
    description: "Assigned clients will appear here.",
  },
};
export const WithOneAction: Story = {
  args: {
    title: "No lesson booked",
    description: "Your coach is ready when you are.",
    action: <Button>Book a lesson</Button>,
  },
};
