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

export const PlainTextBeforeFilter: Story = {
  args: { value: "aac from: member4_6741f3" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const token = canvas.getByTestId("search-filter-token");
    const precedingText = token.previousElementSibling;

    await expect(precedingText).toBeInstanceOf(HTMLElement);
    const precedingTextNode = (precedingText as HTMLElement).firstChild;
    await expect(precedingTextNode).toBeInstanceOf(Text);

    const visibleTextRange = document.createRange();
    const visibleTextLength = (precedingTextNode as Text).data.trimEnd().length;
    visibleTextRange.setStart(precedingTextNode as Text, 0);
    visibleTextRange.setEnd(precedingTextNode as Text, visibleTextLength);

    const tokenStyle = getComputedStyle(token);
    const tokenPadding = getComputedStyle(document.documentElement)
      .getPropertyValue("--spacing-2xs")
      .trim();
    await expect(tokenStyle.paddingInlineStart).toBe(tokenPadding);
    await expect(parseFloat(tokenStyle.marginInlineStart)).toBe(-parseFloat(tokenPadding));
    await expect(Math.ceil(token.getBoundingClientRect().left)).toBeGreaterThanOrEqual(
      Math.floor(visibleTextRange.getBoundingClientRect().right)
    );
  },
};
