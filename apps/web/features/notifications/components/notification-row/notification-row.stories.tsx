import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NotificationProvider } from "../notification-provider";
import { createNotificationStoryServices, notificationItem } from "../notification-story-data";
import { NotificationRow } from "./notification-row";

const friendRequest = notificationItem({
  id: "friend",
  kind: "friendRequestReceived",
  category: "actionRequired",
  categoryRank: 2,
  friendRequestId: "request-1",
});

const meta = {
  title: "Notifications/NotificationRow",
  component: NotificationRow,
  parameters: { layout: "centered" },
  decorators: [
    (Story, context) => {
      const item = context.args.item;
      const services = createNotificationStoryServices([item]);
      return (
        <NotificationProvider
          userId="user-1"
          initialPage={{ items: [item], nextCursor: null }}
          initialSummary={{ unreadCount: item.readAt ? 0 : 1, unseenCount: item.seenAt ? 0 : 1, latestChangeSeq: 1 }}
          initialAttention={[]}
          {...services}
        >
          <div className="w-notifications bg-surface p-xs"><Story /></div>
        </NotificationProvider>
      );
    },
  ],
  args: { item: friendRequest },
} satisfies Meta<typeof NotificationRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActionRequired: Story = {};
export const DirectMention: Story = {
  args: {
    item: notificationItem({
      id: "mention",
      kind: "messageMention",
      category: "direct",
      categoryRank: 1,
      channelName: "general",
      messageSnippet: "Can you help me practice this phrase?",
    }),
  },
};
export const ReadUpdate: Story = {
  args: {
    item: notificationItem({
      id: "call",
      kind: "callCompleted",
      category: "update",
      categoryRank: 0,
      readAt: "2026-07-14T08:20:00.000Z",
      seenAt: "2026-07-14T08:20:00.000Z",
    }),
  },
};
export const LongIdentity: Story = {
  args: {
    item: { ...friendRequest, actor: { id: "long", displayName: "Alexandria Marie Santos-Rivera", username: "alexandria_santos_rivera" } },
  },
};
