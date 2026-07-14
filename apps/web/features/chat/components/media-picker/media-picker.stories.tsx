import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { GifProvider } from "@/features/chat/model/gif-provider";
import { MediaPicker } from "./media-picker";

const storyProvider: GifProvider = {
  name: "KLIPY",
  available: true,
  trending: async () => ({ gifs: [], next: null }),
  search: async () => ({ gifs: [], next: null }),
  registerShare: async () => undefined,
};

const loadingProvider: GifProvider = {
  ...storyProvider,
  trending: async () => new Promise(() => undefined),
  search: async () => new Promise(() => undefined),
};

const failingProvider: GifProvider = {
  ...storyProvider,
  trending: async () => { throw new Error("offline"); },
  search: async () => { throw new Error("offline"); },
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

export const EmojiBrowsing: Story = {};
export const GifEmpty: Story = { args: { defaultTab: "gif" } };
export const GifLoading: Story = {
  args: { defaultTab: "gif", gifProvider: loadingProvider },
};
export const GifError: Story = {
  args: { defaultTab: "gif", gifProvider: failingProvider },
};
export const GifAndStickerDisabled: Story = {
  args: { gifDisabled: true, stickerDisabled: true },
};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
