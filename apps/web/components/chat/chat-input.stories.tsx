import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChatInput } from "./chat-input";

const meta = {
  title: "Chat/ChatInput",
  component: ChatInput,
  tags: ["autodocs"],
  args: {
    placeholder: "Message",
  },
} satisfies Meta<typeof ChatInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = {
  args: {
    value: "I can present the update in the meeting.",
  },
};

export const CustomPlaceholder: Story = {
  args: {
    placeholder: "Send a note to your coach",
  },
};
