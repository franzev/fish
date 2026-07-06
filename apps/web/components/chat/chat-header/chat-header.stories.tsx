import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChatHeader } from "./chat-header";
import { client, coach } from "../story-data";

const meta = {
  title: "Chat/ChatHeader",
  component: ChatHeader,
  tags: ["autodocs"],
  args: {
    participant: coach,
  },
} satisfies Meta<typeof ChatHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {};

export const Offline: Story = {
  args: {
    participant: client,
  },
};

export const ActiveNow: Story = {
  args: {
    participant: {
      ...coach,
      presenceLabel: "Active now",
      showOnlineDot: true,
    },
  },
};

export const LastSeen: Story = {
  args: {
    participant: {
      ...client,
      presenceLabel: "Last seen yesterday at 8:15 PM",
      showOnlineDot: false,
    },
  },
};
