import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LogoutButton } from "./logout-button";

const meta = {
  title: "Product/LogoutButton",
  component: LogoutButton,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof LogoutButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
