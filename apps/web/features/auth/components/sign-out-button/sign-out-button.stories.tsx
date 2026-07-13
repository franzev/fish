import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SignOutButton } from "./sign-out-button";

const meta = {
  title: "Product/SignOutButton",
  component: SignOutButton,
  tags: ["autodocs"],
} satisfies Meta<typeof SignOutButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
