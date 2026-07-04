import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Continue",
    fullWidth: false,
    loading: false,
    variant: "primary",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "ghost"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    children: "I already have an account",
    variant: "secondary",
  },
};

export const Ghost: Story = {
  args: {
    children: "Need help?",
    fullWidth: false,
    variant: "ghost",
  },
};

export const Loading: Story = {
  args: {
    children: "Saving",
    loading: true,
  },
};
