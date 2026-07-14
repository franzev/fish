import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { NotificationProvider } from "../notification-provider";
import { createNotificationStoryServices, notificationStoryItems } from "../notification-story-data";
import { NotificationList } from "./notification-list";

function Provider({ children, items = notificationStoryItems }: { children: React.ReactNode; items?: typeof notificationStoryItems }) {
  const services = createNotificationStoryServices(items);
  return (
    <NotificationProvider
      userId="user-1"
      initialPage={{ items, nextCursor: null }}
      initialSummary={{
        unreadCount: items.filter((item) => item.readAt === null).length,
        unseenCount: items.filter((item) => item.seenAt === null).length,
        latestChangeSeq: 1,
      }}
      initialAttention={[]}
      {...services}
    >
      {children}
    </NotificationProvider>
  );
}

const meta = {
  title: "Notifications/NotificationList",
  component: NotificationList,
  parameters: { layout: "centered" },
  decorators: [(Story) => <Provider><div className="h-notifications-panel-h w-notifications bg-surface"><Story /></div></Provider>],
} satisfies Meta<typeof NotificationList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Categorized: Story = {};
export const Compact: Story = { args: { compact: true } };
export const UnreadFilter: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Unread" }));
  },
};
export const ActionsMenu: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Notification actions" }));
  },
};
export const Empty: Story = {
  decorators: [(Story) => <Provider items={[]}><div className="h-notifications-panel-h w-notifications bg-surface"><Story /></div></Provider>],
};
