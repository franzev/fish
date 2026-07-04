import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConversationList } from "./conversation-list";
import { conversations } from "./story-data";

const meta = {
  title: "Chat/ConversationList",
  component: ConversationList,
  tags: ["autodocs"],
  args: {
    conversations,
    activeConversationId: "c1",
  },
} satisfies Meta<typeof ConversationList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithConversations: Story = {};

export const NoActiveConversation: Story = {
  args: {
    activeConversationId: undefined,
  },
};

export const Empty: Story = {
  args: {
    conversations: [],
    activeConversationId: undefined,
  },
};
