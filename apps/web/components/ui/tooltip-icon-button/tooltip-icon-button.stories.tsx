import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IconMicrophone } from "@tabler/icons-react";
import { fn } from "storybook/test";
import { TooltipIconButton } from "./tooltip-icon-button";

const meta = {
  title: "UI/Tooltip icon button",
  component: TooltipIconButton,
  tags: ["autodocs"],
  args: {
    label: "Mute microphone",
    icon: <IconMicrophone size={20} aria-hidden="true" />,
    onClick: fn(),
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof TooltipIconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Ghost: Story = { args: { variant: "ghost" } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
