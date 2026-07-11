import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MessageMeta } from "./message-meta";

const meta = {
  title: "Chat/MessageMeta",
  component: MessageMeta,
  tags: ["autodocs"],
  args: {
    authorName: "Maya Santos",
    sentAt: "2026-07-04T06:05:00.000Z",
  },
} satisfies Meta<typeof MessageMeta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InvalidTime: Story = {
  args: {
    sentAt: "not-a-date",
  },
};
