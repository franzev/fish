import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IconArrowsDiagonal, IconX } from "@tabler/icons-react";
import { Button } from "../button";
import { PopoverHeader } from "./popover-header";

const closeAction = (
  <Button variant="ghost" controlSize="square" aria-label="Close">
    <IconX size={20} aria-hidden="true" />
  </Button>
);

const meta = {
  title: "UI/Popover header",
  component: PopoverHeader,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { title: <h2 className="text-heading-sm">Messages</h2>, actions: closeAction },
  decorators: [(Story) => <div className="w-notifications rounded-card bg-surface"><Story /></div>],
} satisfies Meta<typeof PopoverHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongTitle: Story = {
  args: { title: <h2 className="truncate text-heading-sm">Notifications that need your attention</h2> },
};
export const MultipleActions: Story = {
  args: {
    actions: (
      <>
        <Button variant="ghost" controlSize="square" aria-label="Open full view">
          <IconArrowsDiagonal size={20} aria-hidden="true" />
        </Button>
        {closeAction}
      </>
    ),
  },
};
