import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { PasswordInput } from "./password-input";

const meta = {
  title: "UI/PasswordInput",
  component: PasswordInput,
  tags: ["autodocs"],
  args: {
    label: "Password",
    autoComplete: "current-password",
    defaultValue: "calm-practice",
  },
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hidden: Story = {};

export const RevealPassword: Story = {
  play: async ({ canvas, userEvent }) => {
    const field = canvas.getByLabelText("Password");
    await expect(field).toHaveAttribute("type", "password");
    await userEvent.click(canvas.getByRole("button", { name: "Show password" }));
    await expect(field).toHaveAttribute("type", "text");
    await expect(
      canvas.getByRole("button", { name: "Hide password" })
    ).toHaveAttribute("aria-pressed", "true");
  },
};
