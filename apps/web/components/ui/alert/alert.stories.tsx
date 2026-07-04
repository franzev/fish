import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Alert } from "./alert";

const meta = {
  title: "UI/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: {
    tone: "notice",
    children: "That doesn't look like an email yet. Check the spelling?",
  },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["notice", "warning", "error", "success"],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Notice: Story = {};

export const Warning: Story = {
  args: {
    tone: "warning",
    children: "That didn't send. Give it a minute and try again.",
  },
};

export const Error: Story = {
  args: {
    tone: "error",
    children: "Something needs your attention before you can continue.",
  },
};

export const Success: Story = {
  args: {
    tone: "success",
    children: "You're all set.",
  },
};
