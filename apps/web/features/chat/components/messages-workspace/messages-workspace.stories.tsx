import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ClientChatData } from "@/lib/services";
import { MessagesWorkspace } from "./messages-workspace";

const conversationId = "00000000-0000-4000-8000-000000000001";
const chat: ClientChatData = {
  conversationId,
  currentUserId: "client-1",
  currentUserRole: "client",
  currentUserDisplayName: "Alex Rivera",
  participant: { id: "coach-1", displayName: "Coach Dana", role: "coach" },
  messages: [
    {
      id: "message-1",
      conversationId,
      senderId: "client-1",
      senderRole: "client",
      body: "I’ll practice that before our next lesson.",
      clientRequestId: "seed-1",
      createdAt: "2026-07-14T08:33:00.000Z",
    },
  ],
};

const meta = {
  title: "Chat/MessagesWorkspace",
  component: MessagesWorkspace,
  parameters: { layout: "fullscreen" },
  args: {
    chat,
    children: (
      <main className="flex min-h-chat-panel flex-1 items-center justify-center p-md">
        <p className="text-ui text-body">Conversation content</p>
      </main>
    ),
  },
} satisfies Meta<typeof MessagesWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClientView: Story = {};
export const CoachView: Story = {
  args: {
    chat: {
      ...chat,
      currentUserId: "coach-1",
      currentUserRole: "coach",
      currentUserDisplayName: "Coach Dana",
      participant: { id: "client-1", displayName: "Alex Rivera", role: "client" },
    },
  },
};
export const EmptyConversation: Story = { args: { chat: { ...chat, messages: [] } } };
export const LongParticipantName: Story = {
  args: {
    chat: {
      ...chat,
      participant: { ...chat.participant, displayName: "Alexandria Marie Santos-Rivera" },
    },
  },
};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
