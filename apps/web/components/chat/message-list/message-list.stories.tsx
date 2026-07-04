import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MessageList } from "./message-list";
import { messages } from "../story-data";

const meta = {
  title: "Chat/MessageList",
  component: MessageList,
  tags: ["autodocs"],
  args: {
    messages,
    firstUnreadId: "m3",
  },
  decorators: [
    (Story) => (
      <div className="h-[560px] rounded-card border border-border bg-bg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithUnreadDivider: Story = {};

export const LoadingOlder: Story = {
  args: {
    loadingOlder: true,
  },
};

export const Empty: Story = {
  args: {
    messages: [],
    firstUnreadId: undefined,
  },
};
