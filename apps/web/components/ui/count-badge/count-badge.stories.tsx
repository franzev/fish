import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CountBadge } from "./count-badge";

const meta = {
  title: "UI/Count badge",
  component: CountBadge,
  tags: ["autodocs"],
  args: { count: 12, "aria-label": "12 unread" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof CountBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const One: Story = { args: { count: 1, "aria-label": "1 unread" } };
export const MaximumExceeded: Story = {
  args: { count: 120, "aria-label": "120 unread" },
};
export const CustomMaximumAndPrefix: Story = {
  args: { count: 20, max: 9, prefix: "@", "aria-label": "20 mentions" },
};
export const Decorative: Story = {
  args: { count: 4, "aria-label": undefined, "aria-hidden": true },
};
export const HiddenAtZero: Story = {
  args: { count: 0, "aria-label": "No unread items" },
};
