import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NotificationProvider } from "../notification-provider";
import { createNotificationStoryServices, notificationStoryItems } from "../notification-story-data";
import { NotificationsScreen } from "./notifications-screen";

const services = createNotificationStoryServices(notificationStoryItems);
const meta = {
  title: "Notifications/NotificationsScreen",
  component: NotificationsScreen,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <NotificationProvider
        userId="user-1"
        initialPage={{ items: notificationStoryItems, nextCursor: null }}
        initialSummary={{ unreadCount: 2, unseenCount: 2, latestChangeSeq: 1 }}
        initialAttention={[]}
        {...services}
      >
        <main className="min-h-screen bg-bg p-page"><Story /></main>
      </NotificationProvider>
    ),
  ],
} satisfies Meta<typeof NotificationsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };
