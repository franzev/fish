import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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
    onClick: fn(),
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

export const Disabled: Story = {
  args: {
    children: "Send message",
    disabled: true,
  },
};

export const ActivatesOnce: Story = {
  args: {
    children: "Send message",
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
