import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NotificationBadge } from "./notification-badge";

const meta = {
  title: "Chat/NotificationBadge",
  component: NotificationBadge,
  tags: ["autodocs"],
  args: {
    count: 2,
  },
} satisfies Meta<typeof NotificationBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Count: Story = {};

export const OneUnread: Story = {
  args: {
    count: 1,
  },
};

export const Capped: Story = {
  args: {
    count: 104,
  },
};

export const Empty: Story = {
  args: {
    count: 0,
  },
};
