import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Message } from "./message";
import { attachments, messages } from "./story-data";

const meta = {
  title: "Chat/Message",
  component: Message,
  tags: ["autodocs"],
  args: {
    message: messages[0],
  },
} satisfies Meta<typeof Message>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Received: Story = {};

export const Mine: Story = {
  args: {
    message: messages[1],
  },
};

export const Grouped: Story = {
  args: {
    grouped: true,
    message: messages[2],
  },
};

export const WithAttachment: Story = {
  args: {
    message: {
      ...messages[3],
      attachments: [attachments[0]],
    },
  },
};
