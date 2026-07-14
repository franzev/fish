import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PresenceAvatar } from "./presence-avatar";

const meta = {
  title: "Product/PresenceAvatar",
  component: PresenceAvatar,
  parameters: { layout: "centered" },
  args: {
    profileId: "coach-dana",
    name: "Coach Dana",
    alt: "Coach Dana",
    size: "md",
    status: "online",
    statusLabel: "Online",
  },
} satisfies Meta<typeof PresenceAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {};
export const Away: Story = { args: { status: "away", statusLabel: "Away" } };
export const Busy: Story = { args: { status: "busy", statusLabel: "Busy" } };
export const Offline: Story = { args: { status: "offline", statusLabel: "Offline" } };
export const Invisible: Story = { args: { status: "invisible", statusLabel: "Invisible" } };
export const Large: Story = { args: { size: "lg" } };
export const LongName: Story = {
  args: { profileId: "alex-long", name: "Alexandria Marie Santos-Rivera", alt: "Alexandria Marie Santos-Rivera" },
};
