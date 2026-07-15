import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PresenceRealtimeService, PresenceRepository, PresenceSnapshot } from "@/lib/services";
import { PresenceProvider } from "../presence-provider";
import { PresenceSummary, type PresenceSummaryProps } from "./presence-summary";

const userId = "22222222-2222-4222-8222-222222222222";

function renderWithStatus(status: PresenceSnapshot["status"], lastSeenAt = "2026-07-14T08:00:00.000Z") {
  function PresenceStatusStory(args: PresenceSummaryProps) {
    const now = new Date().toISOString();
    const snapshot: PresenceSnapshot = {
      userId,
      status,
      lastHeartbeatAt: status === "offline" ? null : now,
      lastSeenAt,
      revision: 1,
      updatedAt: now,
    };
    const repository: PresenceRepository = {
      listVisible: async () => ({ ok: true, data: [snapshot] }),
      getOwnPreference: async () => ({
        ok: true,
        data: { preference: "automatic", expiresAt: null },
      }),
    };
    const realtime: PresenceRealtimeService = {
      startSession: () => ({ markActive: () => undefined, stop: () => undefined }),
      subscribe: () => () => undefined,
    };
    return (
      <PresenceProvider userId="viewer-1" repository={repository} realtime={realtime}>
        <PresenceSummary {...args} />
      </PresenceProvider>
    );
  }
  return PresenceStatusStory;
}

const meta = {
  title: "Product/PresenceSummary",
  component: PresenceSummary,
  parameters: { layout: "centered" },
  args: { userId, showLastSeen: false },
} satisfies Meta<typeof PresenceSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = { render: renderWithStatus("online") };
export const Away: Story = { render: renderWithStatus("away") };
export const Busy: Story = { render: renderWithStatus("busy") };
export const Offline: Story = { render: renderWithStatus("offline") };
export const OfflineWithLastSeen: Story = {
  args: { showLastSeen: true },
  render: renderWithStatus("offline"),
};
export const WithoutProvider: Story = { render: (args) => <PresenceSummary {...args} /> };
