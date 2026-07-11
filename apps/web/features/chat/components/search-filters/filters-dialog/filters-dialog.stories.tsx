import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { FiltersDialog } from "./filters-dialog";

const meta = {
  title: "Chat/FiltersDialog",
  component: FiltersDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof FiltersDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
