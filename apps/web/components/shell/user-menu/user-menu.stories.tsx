import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { UserMenu } from "./user-menu";

const meta = {
  title: "Product/UserMenu",
  component: UserMenu,
  tags: ["autodocs"],
  args: {
    displayName: "Eli Ramos",
    role: "client",
  },
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Client: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Account menu for Eli Ramos" })
    );
    await expect(
      await within(document.body).findByRole("menuitem", { name: "Profile" })
    ).toBeVisible();
  },
};

export const Coach: Story = {
  args: {
    displayName: "Coach Maya",
    role: "coach",
  },
};
