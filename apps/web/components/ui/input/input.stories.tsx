import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    label: "Email",
    placeholder: "you@example.com",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: {
    hint: "Use the email your coach knows.",
  },
};

export const Notice: Story = {
  args: {
    notice: "That doesn't look like an email yet. Check the spelling?",
  },
};

export const Error: Story = {
  args: {
    error: "Something needs your attention before you can continue.",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: "eli@example.com",
  },
};
