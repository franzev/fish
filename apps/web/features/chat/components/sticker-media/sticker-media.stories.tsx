import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StickerMedia } from "./sticker-media";

const meta = {
  title: "Chat/StickerMedia",
  component: StickerMedia,
  parameters: { layout: "centered" },
  args: { stickerId: "aquatic-great-job-sea-star" },
} satisfies Meta<typeof StickerMedia>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {};
export const Unavailable: Story = { args: { stickerId: "unknown-sticker" } };
