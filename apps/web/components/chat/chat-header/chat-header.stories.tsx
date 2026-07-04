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
