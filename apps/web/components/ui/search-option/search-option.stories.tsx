import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IconHash } from "@tabler/icons-react";
import { fn } from "storybook/test";
import { SearchOption } from "./search-option";

const meta = {
  title: "UI/Search option",
  component: SearchOption,
  tags: ["autodocs"],
  decorators: [(Story) => <div role="listbox" aria-label="Channels" className="w-filter-options"><Story /></div>],
  args: {
    selected: false,
    onClick: fn(),
    children: (
      <>
        <IconHash aria-hidden="true" />
        <span>General</span>
      </>
    ),
  },
} satisfies Meta<typeof SearchOption>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Disabled: Story = { args: { disabled: true } };
