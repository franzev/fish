import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CircularProgress } from "./circular-progress";

const meta = {
  title: "UI/Circular progress",
  component: CircularProgress,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { value: 64, label: "Preparing image" },
} satisfies Meta<typeof CircularProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};
export const Starting: Story = { args: { value: 0 } };
export const Complete: Story = { args: { value: 100 } };
export const Clamped: Story = { args: { value: 140 } };
