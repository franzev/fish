import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { NotificationProvider } from "../notification-provider";
import { createNotificationStoryServices, notificationStoryItems } from "../notification-story-data";
import { NotificationBell } from "./notification-bell";

function WithNotifications({ children, unread = 2 }: { children: React.ReactNode; unread?: number }) {
  const services = createNotificationStoryServices(notificationStoryItems);
  return (
    <NotificationProvider
      userId="user-1"
      initialPage={{ items: notificationStoryItems, nextCursor: null }}
      initialSummary={{ unreadCount: unread, unseenCount: unread, latestChangeSeq: 1 }}
      initialAttention={[]}
      {...services}
    >
      {children}
    </NotificationProvider>
  );
}

const meta = {
  title: "Notifications/NotificationBell",
  component: NotificationBell,
  parameters: { layout: "centered" },
  decorators: [(Story) => <WithNotifications><Story /></WithNotifications>],
} satisfies Meta<typeof NotificationBell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unread: Story = {};
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Notifications/ }));
  },
};
export const Read: Story = {
  decorators: [(Story) => <WithNotifications unread={0}><Story /></WithNotifications>],
};
export const WithoutProvider: Story = { decorators: [] };
