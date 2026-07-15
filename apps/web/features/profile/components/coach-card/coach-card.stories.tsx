import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CoachCard } from "./coach-card";

const meta = {
  title: "Product/CoachCard",
  component: CoachCard,
  tags: ["autodocs"],
  args: {
    coachName: "Coach Maya",
  },
} satisfies Meta<typeof CoachCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Assigned: Story = {};
