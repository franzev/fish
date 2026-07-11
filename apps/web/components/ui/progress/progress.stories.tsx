import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Progress } from "./progress";

const meta = {
  title: "UI/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: {
    label: "Step 2 of 5",
    value: 40,
  },
  argTypes: {
    value: {
      control: {
        type: "range",
        min: 0,
        max: 100,
        step: 1,
      },
    },
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NotStarted: Story = {
  args: {
    label: "Getting ready",
    value: 0,
  },
};

export const Complete: Story = {
  args: {
    label: "Ready for your coach",
    value: 100,
  },
};
