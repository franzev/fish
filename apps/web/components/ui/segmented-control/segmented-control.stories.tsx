import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SegmentedControl } from "./segmented-control";

const meta = {
  title: "UI/Segmented control",
  component: SegmentedControl<string>,
  tags: ["autodocs"],
  args: {
    label: "Appearance",
    value: "system",
    options: [
      { label: "System", value: "system" },
      { label: "Light", value: "light" },
      { label: "Dark", value: "dark" },
    ],
    onValueChange: fn(),
  },
} satisfies Meta<typeof SegmentedControl<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ControlCorners: Story = { args: { shape: "control" } };
export const DisabledOption: Story = {
  args: {
    options: [
      { label: "System", value: "system" },
      { label: "Light", value: "light", disabled: true },
      { label: "Dark", value: "dark" },
    ],
  },
};
