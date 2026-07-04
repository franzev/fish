import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LinkPreview } from "./link-preview";
import { linkPreview } from "../story-data";

const meta = {
  title: "Chat/LinkPreview",
  component: LinkPreview,
  tags: ["autodocs"],
  args: linkPreview,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LinkPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithThumbnail: Story = {};

export const WithoutThumbnail: Story = {
  args: {
    thumbnailUrl: undefined,
  },
};
