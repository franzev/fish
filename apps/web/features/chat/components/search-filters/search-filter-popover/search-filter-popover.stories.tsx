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
    members: [
      { id: "1", displayName: "Yoshibro", username: "yoshibro5019" },
      { id: "2", displayName: "Sir Regan", username: "reganspor" },
      { id: "3", displayName: "stellostuds", username: "juststello" },
    ],
    channels: [
      { id: "general", name: "general", slug: "general", conversationId: "community" },
    ],
  },
} satisfies Meta<typeof SearchFilterPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptySearch: Story = {};

export const QuickFiltersOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: "Search messages" }));
    await expect(
      within(document.body).getByRole("menuitem", { name: /From a specific user/ })
    ).toBeVisible();
  },
};

export const FromSuggestions: Story = {
  args: { value: "from: y" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: "Search messages" }));
    await userEvent.keyboard("{End}");
    await expect(
      within(document.body).getByRole("listbox", { name: "From User" })
    ).toBeVisible();
  },
};
