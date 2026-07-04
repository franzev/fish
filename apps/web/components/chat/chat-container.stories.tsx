import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChatContainer } from "./chat-container";
import { coach, messages } from "./story-data";

const meta = {
  title: "Chat/ChatContainer",
  component: ChatContainer,
  tags: ["autodocs"],
  args: {
    participant: coach,
    messages,
    firstUnreadId: "m3",
  },
  decorators: [
    (Story) => (
      <div className="h-[720px] overflow-hidden">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveConversation: Story = {};

export const EmptyConversation: Story = {
  args: {
    messages: [],
    firstUnreadId: undefined,
  },
};

export const LoadingOlder: Story = {
  args: {
    loadingOlder: true,
  },
};
