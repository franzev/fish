import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConversationPreviewRow } from "./conversation-preview-row";

const meta = {
  title: "Chat/ConversationPreviewRow",
  component: ConversationPreviewRow,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div className="w-notifications bg-surface"><Story /></div>],
  args: {
    href: "/messages",
    participant: { id: "gwyn", displayName: "Gwyn" },
    preview: "You: I’ll practice that before our next lesson.",
    latestMessageAt: "2026-07-14T08:33:00.000Z",
    unreadCount: 3,
  },
} satisfies Meta<typeof ConversationPreviewRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Popover: Story = {};
export const Read: Story = { args: { unreadCount: 0 } };
export const RailActive: Story = { args: { presentation: "rail", active: true } };
export const WithoutTimestamp: Story = { args: { latestMessageAt: null } };
export const HighUnreadCount: Story = { args: { unreadCount: 128 } };
export const LongContent: Story = {
  args: {
    participant: { id: "alex", displayName: "Alexandria Santos-Rivera with a long name" },
    preview: "A much longer preview that should stay calm and truncate instead of widening the surrounding navigation.",
  },
};
