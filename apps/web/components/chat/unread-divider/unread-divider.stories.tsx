import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UnreadDivider } from "./unread-divider";

const meta = {
  title: "Chat/UnreadDivider",
  component: UnreadDivider,
  tags: ["autodocs"],
} satisfies Meta<typeof UnreadDivider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
