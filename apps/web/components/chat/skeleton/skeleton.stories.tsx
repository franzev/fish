import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "./skeleton";

const meta = {
  title: "Chat/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadingMessages: Story = {};
