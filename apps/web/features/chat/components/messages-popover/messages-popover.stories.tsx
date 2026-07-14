import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { MessagePopoverActionState, MessagePopoverPreview } from "@/features/chat/contracts";
import { userEvent, within } from "storybook/test";
import { MessagesPopover } from "./messages-popover";

const preview: MessagePopoverPreview = {
  conversationId: "00000000-0000-4000-8000-000000000001",
  participant: { id: "coach-dana", displayName: "Coach Dana", role: "coach" },
  latestMessage: {
    senderId: "coach-dana",
    text: "You used that phrase naturally. Nice work.",
    createdAt: "2026-07-14T08:33:00.000Z",
  },
  unreadCount: 3,
};

const loaded = async (): Promise<MessagePopoverActionState> => ({
  status: "sent",
  values: {},
  previews: [preview],
});

async function openMessages(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: /Messages/ }));
}

const meta = {
  title: "Chat/MessagesPopover",
  component: MessagesPopover,
  parameters: { layout: "centered" },
  args: {
    unreadCount: 3,
    loadPreviewAction: loaded,
  },
} satisfies Meta<typeof MessagesPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const OpenUnread: Story = { play: async ({ canvasElement }) => openMessages(canvasElement) };
export const OpenRead: Story = {
  args: { unreadCount: 0 },
  play: async ({ canvasElement }) => openMessages(canvasElement),
};
export const Loading: Story = {
  args: { loadPreviewAction: async () => new Promise(() => undefined) },
  play: async ({ canvasElement }) => openMessages(canvasElement),
};
export const EmptyConversation: Story = {
  args: {
    loadPreviewAction: async () => ({
      status: "sent",
      values: {},
      previews: [{ ...preview, latestMessage: null }],
    }),
  },
  play: async ({ canvasElement }) => openMessages(canvasElement),
};
export const LoadNotice: Story = {
  args: {
    loadPreviewAction: async () => ({ status: "notice", values: {}, notice: "Messages are still catching up." }),
  },
  play: async ({ canvasElement }) => openMessages(canvasElement),
};
export const LoadFailure: Story = {
  args: { loadPreviewAction: async () => { throw new Error("offline"); } },
  play: async ({ canvasElement }) => openMessages(canvasElement),
};
export const LinkOnlyFallback: Story = { args: { loadPreviewAction: undefined } };
export const HighUnreadAndLongName: Story = {
  args: {
    unreadCount: 128,
    loadPreviewAction: async () => ({
      status: "sent",
      values: {},
      previews: [{
        ...preview,
        participant: { id: "coach-long", displayName: "Coach Alexandria Santos-Rivera", role: "coach" },
      }],
    }),
  },
  play: async ({ canvasElement }) => openMessages(canvasElement),
};
