import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PresenceIndicator } from "./presence-indicator";

const meta = {
  title: "Chat/PresenceIndicator",
  component: PresenceIndicator,
  tags: ["autodocs"],
  args: {
    online: true,
  },
} satisfies Meta<typeof PresenceIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {};

export const Offline: Story = {
  args: {
    online: false,
  },
};

export const ActiveNow: Story = {
  args: {
    label: "Active now",
    online: true,
    showOnlineDot: true,
  },
};

export const LastSeen: Story = {
  args: {
    label: "Last seen yesterday at 8:15 PM",
    online: false,
    showOnlineDot: false,
  },
};
