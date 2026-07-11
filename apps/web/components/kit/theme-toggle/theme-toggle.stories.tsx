import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { KitThemeToggle } from "./theme-toggle";

const meta = {
  title: "Kit/ThemeToggle",
  component: KitThemeToggle,
  tags: ["autodocs"],
} satisfies Meta<typeof KitThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
