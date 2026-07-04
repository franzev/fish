import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MessageActions } from "./message-actions";

const meta = {
  title: "Chat/MessageActions",
  component: MessageActions,
  tags: ["autodocs"],
} satisfies Meta<typeof MessageActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
