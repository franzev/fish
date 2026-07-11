import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MessageStatus } from "./message-status";

const meta = {
  title: "Chat/MessageStatus",
  component: MessageStatus,
  tags: ["autodocs"],
  args: {
    status: "sent",
  },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["sending", "sent", "delivered", "read"],
    },
  },
} satisfies Meta<typeof MessageStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sending: Story = {
  args: {
    status: "sending",
  },
};

export const Sent: Story = {};

export const Delivered: Story = {
  args: {
    status: "delivered",
  },
};

export const Read: Story = {
  args: {
    status: "read",
  },
};
