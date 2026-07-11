import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SearchFilterPopover } from "./search-filter-popover";

const meta = {
  title: "Chat/SearchFilterPopover",
  component: SearchFilterPopover,
  tags: ["autodocs"],
  args: {
    value: "",
    onValueChange: fn(),
  },
} satisfies Meta<typeof SearchFilterPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptySearch: Story = {};

export const QuickFiltersOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Search filters" }));
    await expect(
      within(document.body).getByRole("button", { name: /From a specific user/ })
    ).toBeVisible();
  },
};
