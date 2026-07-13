import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { GifProvider } from "@/features/chat/model/gif-provider";
import { MediaPicker, MediaPickerButton } from "./media-picker";

const storyProvider: GifProvider = {
  name: "KLIPY",
  available: true,
  trending: async () => ({ gifs: [], next: null }),
  search: async () => ({ gifs: [], next: null }),
  registerShare: async () => undefined,
};

const meta = {
  title: "Chat/MediaPicker",
  component: MediaPicker,
  parameters: { layout: "centered" },
  args: {
    onSelectEmoji: () => undefined,
    onSelectGif: () => undefined,
    onSelectSticker: () => undefined,
    gifProvider: storyProvider,
  },
} satisfies Meta<typeof MediaPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StickerBrowsing: Story = {
  args: { defaultTab: "sticker" },
};

export const ComposerTrigger: Story = {
  render: (args) => (
    <MediaPickerButton {...args} defaultTab="sticker" />
  ),
};
