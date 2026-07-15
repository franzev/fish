import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IconArchive } from "@tabler/icons-react";
import { fn } from "storybook/test";
import { IconButton } from "./icon-button";

const meta = {
  title: "UI/Icon button",
  component: IconButton,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    label: "Archive conversation",
    icon: <IconArchive aria-hidden="true" />,
    onClick: fn(),
  },
  argTypes: {
    appearance: {
      control: "inline-radio",
      options: ["ghost", "surface", "solid", "overlay"],
    },
    tone: {
      control: "inline-radio",
      options: ["neutral", "notice", "critical"],
    },
    size: {
      control: "inline-radio",
      options: ["control", "compact"],
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Surface: Story = {};
export const Ghost: Story = { args: { appearance: "ghost" } };
export const Solid: Story = { args: { appearance: "solid" } };
export const Overlay: Story = { args: { appearance: "overlay" } };
export const Notice: Story = { args: { appearance: "ghost", tone: "notice" } };
export const Critical: Story = { args: { tone: "critical" } };
export const Compact: Story = { args: { size: "compact" } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
