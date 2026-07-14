import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { MediaPickerSearch, type MediaPickerSearchProps } from "./media-picker-search";

function StatefulSearch(args: MediaPickerSearchProps) {
  const [value, setValue] = useState(args.value);
  return (
    <MediaPickerSearch
      {...args}
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  );
}

const meta = {
  title: "Chat/MediaPickerSearch",
  component: MediaPickerSearch,
  render: (args) => <StatefulSearch {...args} />,
  parameters: { layout: "centered" },
  decorators: [(Story) => <div className="w-gif-panel bg-surface"><Story /></div>],
  args: {
    label: "Search stickers",
    placeholder: "Search stickers",
    value: "",
    onChange: () => undefined,
  },
} satisfies Meta<typeof MediaPickerSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Populated: Story = { args: { value: "celebrate" } };
export const CustomLimit: Story = { args: { maxLength: 12, value: "encouragement" } };
export const LongLabel: Story = {
  args: { label: "Search the available reaction stickers", placeholder: "Find a reaction" },
};
