import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StickerPicker } from "./sticker-picker";

const meta = {
  title: "Chat/StickerPicker",
  component: StickerPicker,
  parameters: { layout: "centered" },
  args: {
    onSelect: () => undefined,
    className: "h-gif-panel-h w-gif-panel bg-surface",
  },
} satisfies Meta<typeof StickerPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AquaticSamples: Story = {};
