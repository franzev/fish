import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import type {
  PresenceCommandService,
  PresenceRealtimeService,
  PresenceRepository,
} from "@/lib/services";
import { PresenceProvider } from "@/features/presence";
import { UserMenu } from "./user-menu";

const storyUserId = "11111111-1111-4111-8111-111111111111";
const repository: PresenceRepository = {
  listVisible: async () => {
    const now = new Date().toISOString();
    return {
      ok: true,
      data: [{
        userId: storyUserId,
        status: "online",
        lastHeartbeatAt: now,
        lastSeenAt: now,
        revision: 1,
        updatedAt: now,
      }],
    };
  },
  getOwnPreference: async () => ({
    ok: true,
    data: { preference: "automatic", expiresAt: null },
  }),
};
const realtime: PresenceRealtimeService = {
  subscribe: () => () => {},
  startSession: () => ({ markActive: () => {}, stop: () => {} }),
};
const reconnectingRealtime: PresenceRealtimeService = {
  subscribe: (
    _userId,
    _subjectIds,
    _onSnapshot,
    _onPreference,
    _onRecovery,
    onStatus
  ) => {
    const timer = window.setTimeout(() => onStatus?.("disconnected"), 0);
    return () => window.clearTimeout(timer);
  },
  startSession: () => ({ markActive: () => {}, stop: () => {} }),
};
const commands: PresenceCommandService = {
  setMode: async () => ({
    ok: false,
    code: "presence_unavailable",
    notice: "Your status could not change. Try again.",
  }),
};

const meta = {
  title: "Product/UserMenu",
  component: UserMenu,
  tags: ["autodocs"],
  args: {
    displayName: "Eli Ramos",
    role: "client",
    friendsNavEnabled: true,
    profileId: storyUserId,
  },
  decorators: [
    (Story) => (
      <PresenceProvider
        userId={storyUserId}
        repository={repository}
        realtime={realtime}
        commands={commands}
      >
        <Story />
      </PresenceProvider>
    ),
  ],
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Client: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Account menu for Eli Ramos" })
    );
    await expect(
      await within(document.body).findByRole("menuitem", { name: "Profile" })
    ).toBeVisible();
  },
};

export const Coach: Story = {
  args: {
    displayName: "Coach Maya",
    role: "coach",
  },
};

export const LongDisplayName: Story = {
  args: {
    displayName: "Alexandria Montgomery-Watanabe",
  },
};

export const MobileStatusPicker: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Account menu for Eli Ramos" })
    );
    const body = within(document.body);
    await userEvent.click(await body.findByRole("menuitem", { name: /Status/ }));
    await expect(
      await body.findByRole("menuitem", { name: /Invisible/ })
    ).toBeVisible();
  },
};

export const CalmRetryGuidance: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Account menu for Eli Ramos" })
    );
    const body = within(document.body);
    await userEvent.click(await body.findByRole("menuitem", { name: /Status/ }));
    await userEvent.click(await body.findByRole("menuitem", { name: /Away/ }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Forever" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Account menu for Eli Ramos" })
    );
    await userEvent.click(await body.findByRole("menuitem", { name: /Status/ }));
    await expect(
      await body.findByText("Your status could not change. Try again.")
    ).toBeVisible();
  },
};

export const Reconnecting: Story = {
  render: (args) => (
    <PresenceProvider
      userId={storyUserId}
      repository={repository}
      realtime={reconnectingRealtime}
      commands={commands}
    >
      <UserMenu {...args} />
    </PresenceProvider>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Account menu for Eli Ramos" })
    );
    const body = within(document.body);
    await userEvent.click(await body.findByRole("menuitem", { name: /Status/ }));
    await expect(
      await body.findByText("Status is reconnecting. We’ll keep trying.")
    ).toBeVisible();
  },
};
