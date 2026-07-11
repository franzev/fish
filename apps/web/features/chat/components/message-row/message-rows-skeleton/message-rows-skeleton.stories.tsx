import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MessageRowsSkeleton } from "./message-rows-skeleton";

const meta = {
  title: "Chat/MessageRowsSkeleton",
  component: MessageRowsSkeleton,
  tags: ["autodocs"],
} satisfies Meta<typeof MessageRowsSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadingEarlierMessages: Story = {};
