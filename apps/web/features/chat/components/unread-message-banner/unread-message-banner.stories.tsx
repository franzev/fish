import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UnreadMessageBanner } from "./unread-message-banner";

const meta = {
  title: "Chat/UnreadMessageBanner",
  component: UnreadMessageBanner,
  tags: ["autodocs"],
  args: {
    count: 11,
    oldestUnreadAt: "2026-07-14T07:25:00.000Z",
    onMarkRead: () => undefined,
  },
  decorators: [
    (Story) => <div className="bg-bg py-md"><Story /></div>,
  ],
} satisfies Meta<typeof UnreadMessageBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Retry: Story = {
  args: { notice: "Messages weren’t marked as read. Try again." },
};

export const SingleMessage: Story = { args: { count: 1 } };
export const WithoutTimestamp: Story = { args: { oldestUnreadAt: null } };
export const HighCount: Story = { args: { count: 128 } };
export const Pending: Story = { args: { pending: true } };
export const Hidden: Story = { args: { count: 0 } };
