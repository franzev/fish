import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IconX } from "@tabler/icons-react";
import { IconButton } from "../icon-button";
import { SurfaceHeader } from "./surface-header";

const meta = {
  title: "UI/Surface header",
  component: SurfaceHeader,
  tags: ["autodocs"],
  args: {
    title: <h2>Messages</h2>,
    action: (
      <IconButton
        label="Close messages"
        appearance="ghost"
        icon={<IconX aria-hidden="true" />}
      />
    ),
  },
} satisfies Meta<typeof SurfaceHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithDescription: Story = {
  args: { description: "Your recent conversations" },
};
