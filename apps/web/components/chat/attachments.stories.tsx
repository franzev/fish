import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Attachments } from "./attachments";
import { attachments } from "./story-data";

const meta = {
  title: "Chat/Attachments",
  component: Attachments,
  tags: ["autodocs"],
  args: {
    attachments,
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Attachments>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllKinds: Story = {};

export const ImageOnly: Story = {
  args: {
    attachments: [attachments[0]],
  },
};

export const Empty: Story = {
  args: {
    attachments: [],
  },
};
